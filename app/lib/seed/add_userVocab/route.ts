import { NextResponse } from "next/server";
import { deleteUserVocabForUser, upsertUserVocab } from "@/app/lib/services/dao";
import type { Mastery } from "@/domain/review/scheduler";

const DEFAULT_USER_ID = "410544b2-4001-4271-9855-fec4b6a6442a"; // Valuable Student (initdb seed)

export async function GET(request: Request) {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") ?? DEFAULT_USER_ID;

    // Drop every row for this user before seeding.
    await deleteUserVocabForUser(userId);

    // Unit IDs to add to this user's vocab.
    // Source: your pasted list (route.ts 2-29).
    const unitIds = [
        "c9a0ef89-fe4d-48df-99fc-df8cbbcdfd78",
        "21de9a25-ca8e-4290-95a9-90c25c9398a5",
        "bb6cdacb-e69e-4500-9e8c-1a892c3f0d26",
        "d56b854e-b2c2-4fa7-b163-fae05d234681",
        "a2d89ab5-b740-4f8b-96e2-48f9caaa817a",
        "29190de7-2db0-4609-a461-2a14da15050e",
        "d1b8b6d2-1319-4ba1-8655-24962abe0f3c",
        "2501c8a4-de8e-453c-ad6d-ff7d61a008eb",
        "75d1fe66-49e6-42ce-9331-ab89bc89d37c",
        "6e8542f4-0656-4308-8eeb-faa1a6408362",
        "8db87f67-5671-40cf-bc22-59e060e87ee7",
        "bd137f52-950e-45c7-97b3-6817ba332e26",
        "940aa319-afbf-420a-b47b-3fe22b6cd8e3",
        "77cb4be7-7093-4b24-851e-696f0c8e1105",
        "ea6ec81f-d230-4a6b-9207-418b5ee233fc",
        "d6173e91-6446-477a-a7d6-a9749b53e6da",
        "acfb1992-d073-46da-8524-d813afceffc3",
        "c375d368-69b0-4d58-bc83-c3b903259f6e",
        "b173230c-686f-43fb-8395-85e9bc31aa22",
        "9d719633-bb27-4592-9e07-f1d0a910a9f8",
        "1e8a7780-7aa3-4c91-8287-fcfac32d1e2a",
        "3ef031f4-4856-4915-8ee3-db6b5ae02c42",
        "5ff1bbf8-2af5-4ec4-9aff-92f2171f9acb",
        "91198c54-d688-4f6f-a0a5-4a703e4a30f6",
        "970f49d2-13f4-49ff-b7fa-6f7253101c81",
        "c19b60a3-42e1-4753-a82a-e4dc64ee149a",
    ];

    const uniqueUnitIds = Array.from(new Set(unitIds));

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
        requested: uniqueUnitIds.length,
        succeeded: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
    });
}
