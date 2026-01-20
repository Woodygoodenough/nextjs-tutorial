import { eq } from "drizzle-orm";
import { userVocab } from "@/app/lib/db/schema";
import { getNextReviewDate, Mastery } from "@/domain/review/scheduler";
import { DEFAULT_REVIEW_SETTINGS } from "@/domain/review/reviewSettings";
import { db } from "@/app/lib/db/client";

export async function upsertUserVocab(userId: string, unitId: string, progress: number, recentMastery: Mastery, lastReviewedAt: Date = new Date()): Promise<void> {
    // if progress is passed as 0, we enforce recentMastery to be null
    if (progress === 0) {
        recentMastery = null;
    }
    await db
        .insert(userVocab)
        .values({
            userId,
            unitId,
            createdAt: lastReviewedAt,
            // initialize to added time; update later when actually reviewed
            lastReviewedAt: lastReviewedAt,
            progress: progress,
            recentMastery: recentMastery,
            nextReviewAt: (await getNextReviewDate(progress, recentMastery, lastReviewedAt, DEFAULT_REVIEW_SETTINGS)).nextReviewAt,
        })
        .onConflictDoNothing({ target: [userVocab.userId, userVocab.unitId] });
}

export async function deleteUserVocabForUser(userId: string): Promise<void> {
    await db.delete(userVocab).where(eq(userVocab.userId, userId));
}
