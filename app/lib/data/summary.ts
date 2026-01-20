"use server";
import { SelectUserVocab, SelectUserProgressRecord, userProgressRecord, userVocab } from "@/app/lib/db/schema";
import { and, count, desc, eq, lt } from "drizzle-orm";
import { getPercentageProgress } from "@/domain/review/scheduler";
import { db } from "@/app/lib/db/client";

export async function getUserTotalVocab(userId: string): Promise<number> {
    const totalRows = await db.select({ total: count() }).from(userVocab).where(eq(userVocab.userId, userId));
    return totalRows[0]?.total ?? 0;
}

export async function getUserAverageProgress(userId: string): Promise<number> {
    const terms = await db
        .select({ progress: userVocab.progress })
        .from(userVocab)
        .where(eq(userVocab.userId, userId));
    if (terms.length === 0) return 0;
    const percentages = await Promise.all(terms.map((t) => getPercentageProgress(t.progress)));
    return percentages.reduce((a, b) => a + b, 0) / percentages.length;
}

export async function getReviewDue(userId: string): Promise<SelectUserVocab[]> {
    const userVocabReviewDue = await db
        .select()
        .from(userVocab)
        .where(and(eq(userVocab.userId, userId), lt(userVocab.nextReviewAt, new Date())));

    return userVocabReviewDue;
}

export async function getRecentProgressRecords(userId: string, days: number = 7): Promise<SelectUserProgressRecord[]> {
    return await db
        .select()
        .from(userProgressRecord)
        .where(eq(userProgressRecord.userId, userId))
        .orderBy(desc(userProgressRecord.date))
        .limit(days);
}
