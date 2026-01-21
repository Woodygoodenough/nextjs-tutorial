import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userProgressRecord } from "@/lib/db/schema";

const DEFAULT_USER_ID = "410544b2-4001-4271-9855-fec4b6a6442a"; // Valuable Student (initdb seed)

function toYmd(d: Date): string {
    // YYYY-MM-DD in UTC (safe for Postgres date)
    return d.toISOString().slice(0, 10);
}

function randInt(minInclusive: number, maxInclusive: number): number {
    return Math.floor(Math.random() * (maxInclusive - minInclusive + 1)) + minInclusive;
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") ?? DEFAULT_USER_ID;

    // Defaults: 30 days of history ending today, vocab counts around 2000–3000.
    const days = Number(url.searchParams.get("days") ?? "30");
    const minVocab = Number(url.searchParams.get("minVocab") ?? "2000");
    const maxVocab = Number(url.searchParams.get("maxVocab") ?? "3000");

    // Clear existing rows for this user so the seed is repeatable.
    await db.delete(userProgressRecord).where(eq(userProgressRecord.userId, userId));

    const today = new Date();
    const nDays = Math.max(1, days);

    // ---- Generate "typical" history ----
    // - vocab_count: always increasing
    // - average_progress: stable-ish with small noise, occasional slight dips
    const startVocab = randInt(minVocab, Math.min(maxVocab, minVocab + 250));
    const endVocab = randInt(Math.max(startVocab, maxVocab - 250), maxVocab);
    let prevVocab = startVocab;

    const baseProgress = randInt(48, 52); // very stable baseline
    let prevAvgProgress = baseProgress;

    const rows = Array.from({ length: nDays }, (_, i) => {
        // Oldest -> newest
        const daysAgo = Math.max(0, days - 1 - i);
        const d = new Date(today.getTime() - daysAgo * 24 * 60 * 60 * 1000);

        // vocab_count: monotonic increasing, with small daily increments
        const t = nDays === 1 ? 1 : i / (nDays - 1);
        const target = Math.round(startVocab + t * (endVocab - startVocab));
        const proposed = target + randInt(0, 6); // small noise but doesn't break monotonicity
        const vocabCount = Math.min(maxVocab, Math.max(prevVocab, proposed));
        prevVocab = vocabCount;

        // average_progress: very stable around 48–52 with minor disturbances
        const step = randInt(-1, 1); // small day-to-day jitter
        const occasionalDip = Math.random() < 0.12 ? -randInt(1, 2) : 0;
        const occasionalBump = Math.random() < 0.08 ? randInt(1, 2) : 0;
        const nextAvg = prevAvgProgress + step + occasionalDip + occasionalBump;
        const averageProgress = Math.max(0, Math.min(100, nextAvg));
        prevAvgProgress = averageProgress;

        return {
            userId,
            date: toYmd(d),
            vocabCount,
            averageProgress,
        };
    });

    // Insert (PK prevents duplicates, but we deleted anyway).
    await db.insert(userProgressRecord).values(rows);

    return NextResponse.json({
        ok: true,
        userId,
        days: rows.length,
        vocabCountRange: { min: minVocab, max: maxVocab },
        inserted: rows.length,
        from: rows[0]?.date,
        to: rows[rows.length - 1]?.date,
    });
}

