import { and, eq, isNull } from "drizzle-orm";
import { mwPronunciation } from "@/app/lib/db/schema";
import type { SelectMwPronunciation, InsertMwPronunciation } from "@/app/lib/db/schema";
import { db } from "@/app/lib/db/client";

/**
 * Fetch all pronunciations for a given entry UUID, ordered by rank.
 * If droId is provided, only fetches pronunciations for that specific DRO.
 * If droId is null, fetches entry-level pronunciations.
 */
export async function fetchPronunciationsByEntryUuid(
    entryUuid: string,
    droId?: string | null
): Promise<SelectMwPronunciation[]> {
    const conditions = [eq(mwPronunciation.entryUuid, entryUuid)];
    
    if (droId === null) {
        // Explicitly fetch entry-level pronunciations (droId is null)
        conditions.push(isNull(mwPronunciation.droId));
    } else if (droId !== undefined) {
        // Fetch pronunciations for a specific DRO
        conditions.push(eq(mwPronunciation.droId, droId));
    }
    // If droId is undefined, fetch all pronunciations for the entry
    
    return await db
        .select()
        .from(mwPronunciation)
        .where(and(...conditions))
        .orderBy(mwPronunciation.rank);
}

/**
 * Fetch entry-level pronunciations (where droId is null).
 */
export async function fetchEntryLevelPronunciations(entryUuid: string): Promise<SelectMwPronunciation[]> {
    return await db
        .select()
        .from(mwPronunciation)
        .where(and(
            eq(mwPronunciation.entryUuid, entryUuid),
            isNull(mwPronunciation.droId)
        ))
        .orderBy(mwPronunciation.rank);
}

/**
 * Fetch pronunciations for a specific DRO.
 */
export async function fetchPronunciationsByDroId(droId: string): Promise<SelectMwPronunciation[]> {
    return await db
        .select()
        .from(mwPronunciation)
        .where(eq(mwPronunciation.droId, droId))
        .orderBy(mwPronunciation.rank);
}

/**
 * Fetch a single pronunciation by its ID.
 */
export async function fetchPronunciationById(pronunciationId: string): Promise<SelectMwPronunciation | null> {
    const rows = await db
        .select()
        .from(mwPronunciation)
        .where(eq(mwPronunciation.pronunciationId, pronunciationId))
        .limit(1);
    return rows[0] ?? null;
}

/**
 * Fetch pronunciations by audio base filename.
 */
export async function fetchPronunciationsByAudioBase(audioBase: string): Promise<SelectMwPronunciation[]> {
    return await db
        .select()
        .from(mwPronunciation)
        .where(eq(mwPronunciation.audioBase, audioBase))
        .orderBy(mwPronunciation.rank);
}

/**
 * Insert a single pronunciation. Uses onConflictDoNothing to handle duplicates.
 */
export async function insertPronunciation(pronunciation: InsertMwPronunciation): Promise<void> {
    await db
        .insert(mwPronunciation)
        .values(pronunciation)
        .onConflictDoNothing({ target: [mwPronunciation.entryUuid, mwPronunciation.droId, mwPronunciation.rank] });
}

/**
 * Insert multiple pronunciations in a batch. Uses onConflictDoNothing to handle duplicates.
 */
export async function insertPronunciations(pronunciations: InsertMwPronunciation[]): Promise<void> {
    if (pronunciations.length === 0) return;
    await db
        .insert(mwPronunciation)
        .values(pronunciations)
        .onConflictDoNothing({ target: [mwPronunciation.entryUuid, mwPronunciation.droId, mwPronunciation.rank] });
}

/**
 * Upsert a pronunciation. Updates if conflict on (entryUuid, droId, rank), otherwise inserts.
 */
export async function upsertPronunciation(pronunciation: InsertMwPronunciation): Promise<void> {
    await db
        .insert(mwPronunciation)
        .values(pronunciation)
        .onConflictDoUpdate({
            target: [mwPronunciation.entryUuid, mwPronunciation.droId, mwPronunciation.rank],
            set: {
                mw: pronunciation.mw,
                l: pronunciation.l,
                l2: pronunciation.l2,
                pun: pronunciation.pun,
                audioBase: pronunciation.audioBase,
                langCode: pronunciation.langCode,
                countryCode: pronunciation.countryCode,
                fetchedAt: pronunciation.fetchedAt,
            },
        });
}

/**
 * Delete all pronunciations for a given entry UUID.
 */
export async function deletePronunciationsByEntryUuid(entryUuid: string): Promise<void> {
    await db.delete(mwPronunciation).where(eq(mwPronunciation.entryUuid, entryUuid));
}

/**
 * Delete all pronunciations for a specific DRO.
 */
export async function deletePronunciationsByDroId(droId: string): Promise<void> {
    await db.delete(mwPronunciation).where(eq(mwPronunciation.droId, droId));
}
