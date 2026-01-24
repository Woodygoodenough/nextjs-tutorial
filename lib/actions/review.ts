"use server";

import { db } from "@/lib/db/client";
import { userVocab, learningUnit, mwStem } from "@/lib/db/schema";
import { and, eq, lte, or, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUserId } from "./require-user-id";
import { getNextReviewDate } from "@/domain/review/scheduler";
import { getWordDetail, WordDetail } from "./library";

export async function getDueReviewCount(): Promise<number> {
  const userId = await requireUserId();
  const now = new Date();

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(userVocab)
    .where(
      and(
        eq(userVocab.userId, userId),
        or(
          lte(userVocab.nextReviewAt, now),
          isNull(userVocab.nextReviewAt)
        )
      )
    );

  return Number(result[0]?.count ?? 0);
}

export async function getDueReviewItems(limit: number = 10): Promise<WordDetail[]> {
  const userId = await requireUserId();
  const now = new Date();

  // Fetch due unit IDs
  const dueUnits = await db
    .select({ unitId: userVocab.unitId })
    .from(userVocab)
    .where(
      and(
        eq(userVocab.userId, userId),
        or(
          lte(userVocab.nextReviewAt, now),
          isNull(userVocab.nextReviewAt)
        )
      )
    )
    .orderBy(userVocab.nextReviewAt) // Review overdue items first
    .limit(limit);

  if (dueUnits.length === 0) {
    return [];
  }

  // Fetch full details for each unit
  // We use Promise.all to fetch them in parallel
  // getWordDetail is already optimized for single-unit fetching
  const details = await Promise.all(
    dueUnits.map((u) => getWordDetail(u.unitId))
  );

  // Filter out any nulls (in case a unit was deleted but user_vocab remained, though FKs should prevent this)
  return details.filter((d): d is WordDetail => d !== null);
}

export async function submitReview(unitId: string, isRemembered: boolean) {
  const userId = await requireUserId();
  const now = new Date();

  // 1. Get current progress
  const currentVocab = await db
    .select()
    .from(userVocab)
    .where(and(eq(userVocab.userId, userId), eq(userVocab.unitId, unitId)))
    .limit(1);

  if (currentVocab.length === 0) {
    throw new Error("User vocab record not found");
  }

  const vocab = currentVocab[0];

  // 2. Calculate new schedule
  // Mastery: 1 for remembered (pass), 0 for not remembered (fail)
  // We treat "I remember" as pass (1) and "I don't remember" as fail (0).
  const mastery = isRemembered ? 1 : 0;

  const result = await getNextReviewDate(
    vocab.progress,
    mastery,
    now // lastReviewedAt is now
  );

  // 3. Update DB
  await db
    .update(userVocab)
    .set({
      lastReviewedAt: now,
      nextReviewAt: result.nextReviewAt,
      progress: result.newProgress,
      recentMastery: result.mastery,
    })
    .where(and(eq(userVocab.userId, userId), eq(userVocab.unitId, unitId)));

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/review");

  return {
    success: true,
    nextReviewAt: result.nextReviewAt,
    progress: result.newProgress
  };
}
