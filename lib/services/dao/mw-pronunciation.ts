import { and, eq } from "drizzle-orm";
import { mwPronunciation } from "@/lib/db/schema";
import type { InsertMwPronunciation, SelectMwPronunciation } from "@/lib/db/schema";
import { db } from "@/lib/db/client";

/**
 * Fetch pronunciations for a specific owner (polymorphic).
 */
export async function fetchPronunciationsByOwner(
    ownerType: string,
    ownerId: string,
): Promise<SelectMwPronunciation[]> {
    return await db
        .select()
        .from(mwPronunciation)
        .where(and(eq(mwPronunciation.ownerType, ownerType), eq(mwPronunciation.ownerId, ownerId)))
        .orderBy(mwPronunciation.rank);
}

/**
 * Headword pronunciations (hwi.prs): ownerType=HWI, ownerId=<entry_uuid>
 */
export async function fetchHwiPronunciations(entryUuid: string): Promise<SelectMwPronunciation[]> {
    return fetchPronunciationsByOwner("HWI", entryUuid);
}

/**
 * DRO pronunciations: ownerType=DRO, ownerId=<dro_id>
 */
export async function fetchPronunciationsByDroId(droId: string): Promise<SelectMwPronunciation[]> {
    return fetchPronunciationsByOwner("DRO", droId);
}

/**
 * URO pronunciations: ownerType=URO, ownerId=<uro_id>
 */
export async function fetchPronunciationsByUroId(uroId: string): Promise<SelectMwPronunciation[]> {
    return fetchPronunciationsByOwner("URO", uroId);
}

/**
 * Fetch a single pronunciation by its ID.
 */
export async function fetchPronunciationById(prId: string): Promise<SelectMwPronunciation | null> {
    const rows = await db
        .select()
        .from(mwPronunciation)
        .where(eq(mwPronunciation.prId, prId))
        .limit(1);
    return rows[0] ?? null;
}

/**
 * Fetch pronunciations by sound.audio base filename.
 */
export async function fetchPronunciationsBySoundAudio(soundAudio: string): Promise<SelectMwPronunciation[]> {
    return await db
        .select()
        .from(mwPronunciation)
        .where(eq(mwPronunciation.soundAudio, soundAudio))
        .orderBy(mwPronunciation.rank);
}

/**
 * Insert a single pronunciation. Uses onConflictDoNothing to handle duplicates.
 */
export async function insertPronunciation(pronunciation: InsertMwPronunciation): Promise<void> {
    await db
        .insert(mwPronunciation)
        .values(pronunciation)
        .onConflictDoNothing({
            target: [mwPronunciation.ownerType, mwPronunciation.ownerId, mwPronunciation.rank],
        });
}

/**
 * Insert multiple pronunciations in a batch. Uses onConflictDoNothing to handle duplicates.
 */
export async function insertPronunciations(pronunciations: InsertMwPronunciation[]): Promise<void> {
    if (pronunciations.length === 0) return;
    await db
        .insert(mwPronunciation)
        .values(pronunciations)
        // Batch insert: rely on the DB's unique indexes / constraints for correct deduping.
        // (We can't choose per-row conflict targets here.)
        .onConflictDoNothing();
}

/**
 * Upsert a pronunciation. Updates if conflict on (owner_type, owner_id, rank), otherwise inserts.
 */
export async function upsertPronunciation(pronunciation: InsertMwPronunciation): Promise<void> {
    await db
        .insert(mwPronunciation)
        .values(pronunciation)
        .onConflictDoUpdate({
            target: [mwPronunciation.ownerType, mwPronunciation.ownerId, mwPronunciation.rank],
            set: {
                mw: pronunciation.mw,
                l: pronunciation.l,
                l2: pronunciation.l2,
                pun: pronunciation.pun,
                soundAudio: pronunciation.soundAudio,
                soundRef: pronunciation.soundRef,
                soundStat: pronunciation.soundStat,
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

export async function deletePronunciationsByOwner(ownerType: string, ownerId: string): Promise<void> {
    await db
        .delete(mwPronunciation)
        .where(and(eq(mwPronunciation.ownerType, ownerType), eq(mwPronunciation.ownerId, ownerId)));
}

