import { NextResponse } from "next/server";
import { deleteUserVocabForUser, upsertUserVocab } from "@/lib/services/dao";
import type { Mastery } from "@/domain/review/scheduler";
import { sql } from "@/lib/db/client";

const DEFAULT_USER_ID = "410544b2-4001-4271-9855-fec4b6a6442a"; // Valuable Student (initdb seed)

export async function GET(request: Request) {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") ?? DEFAULT_USER_ID;
    const reset = (url.searchParams.get("reset") ?? "1") !== "0";

    if (reset) {
        // Drop every row for this user before seeding.
        await deleteUserVocabForUser(userId);
    }

    // Unit IDs to add to this user's vocab: pull from learning_unit directly.
    const unitRows = await sql<Array<{ unit_id: string }>>`
      SELECT unit_id
      FROM learning_unit
      ORDER BY created_at ASC
    `;

    const uniqueUnitIds = unitRows.map((r) => r.unit_id).filter(Boolean);

    // Guarantee at least 3 words are "new": progress = 0 (and thus recentMastery must be null).
    const zeroProgressUnitIds = new Set(uniqueUnitIds.slice(0, 3));

    function randInt(minInclusive: number, maxInclusive: number): number {
        return Math.floor(Math.random() * (maxInclusive - minInclusive + 1)) + minInclusive;
    }

    function randMastery(): Mastery {
        return Math.random() < 0.5 ? 0 : 1;
    }

    function randLastReviewedAt(now: Date): Date {
        // Skew distribution so most are recent, but a few are closer to 5 days ago.
        // bucket: 0 = now-ish, 1 = 0-2 days ago, 2 = 2-5 days ago
        const r = Math.random();
        const bucket = r < 0.55 ? 0 : r < 0.85 ? 1 : 2;

        const maxDaysAgo = bucket === 0 ? 0.25 : bucket === 1 ? 2 : 5; // 6 hours, 2 days, 5 days
        const daysAgo = Math.random() * maxDaysAgo;
        const ms = daysAgo * 24 * 60 * 60 * 1000;
        return new Date(now.getTime() - ms);
    }

    const results: Array<{ unitId: string; ok: boolean; progress?: number; recentMastery?: Mastery; error?: string }> = [];
    for (const unitId of uniqueUnitIds) {
        try {
            const progress = zeroProgressUnitIds.has(unitId) ? 0 : randInt(1, 40);
            const recentMastery: Mastery = progress === 0 ? null : randMastery();
            const lastReviewedAt = randLastReviewedAt(new Date());
            await upsertUserVocab(userId, unitId, progress, recentMastery, lastReviewedAt);
            results.push({ unitId, ok: true, progress, recentMastery });
        } catch (e) {
            results.push({ unitId, ok: false, error: e instanceof Error ? e.message : String(e) });
        }
    }

    return NextResponse.json({
        ok: true,
        userId,
        reset,
        requested: uniqueUnitIds.length,
        succeeded: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
    });
}
