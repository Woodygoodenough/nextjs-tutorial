import { eq } from "drizzle-orm";
import { mwUro } from "@/lib/db/schema";
import type { SelectMwUro, InsertMwUro } from "@/lib/db/schema";
import { db } from "@/lib/db/client";

/**
 * Fetch all UROs (undefined run-ons) for a given entry UUID, ordered by rank.
 */
export async function fetchUrosByEntryUuid(entryUuid: string): Promise<SelectMwUro[]> {
    return await db
        .select()
        .from(mwUro)
        .where(eq(mwUro.entryUuid, entryUuid))
        .orderBy(mwUro.rank);
}

/**
 * Fetch a single URO by its ID.
 */
export async function fetchUroById(uroId: string): Promise<SelectMwUro | null> {
    const rows = await db
        .select()
        .from(mwUro)
        .where(eq(mwUro.uroId, uroId))
        .limit(1);
    return rows[0] ?? null;
}

/**
 * Fetch UROs by URE (undefined entry word) text.
 */
export async function fetchUrosByUre(ure: string): Promise<SelectMwUro[]> {
    return await db
        .select()
        .from(mwUro)
        .where(eq(mwUro.ure, ure))
        .orderBy(mwUro.rank);
}

/**
 * Insert a single URO. Uses onConflictDoNothing to handle duplicates.
 */
export async function insertUro(uro: InsertMwUro): Promise<void> {
    await db
        .insert(mwUro)
        .values(uro)
        .onConflictDoNothing({ target: [mwUro.entryUuid, mwUro.rank] });
}

/**
 * Insert multiple UROs in a batch. Uses onConflictDoNothing to handle duplicates.
 */
export async function insertUros(uros: InsertMwUro[]): Promise<void> {
    if (uros.length === 0) return;
    await db
        .insert(mwUro)
        .values(uros)
        .onConflictDoNothing({ target: [mwUro.entryUuid, mwUro.rank] });
}

/**
 * Upsert a URO. Updates if conflict on (entryUuid, rank), otherwise inserts.
 */
export async function upsertUro(uro: InsertMwUro): Promise<void> {
    await db
        .insert(mwUro)
        .values(uro)
        .onConflictDoUpdate({
            target: [mwUro.entryUuid, mwUro.rank],
            set: {
                ure: uro.ure,
                fl: uro.fl,
                utxt: uro.utxt,
                rawJson: uro.rawJson,
                fetchedAt: uro.fetchedAt,
            },
        });
}

/**
 * Delete all UROs for a given entry UUID.
 */
export async function deleteUrosByEntryUuid(entryUuid: string): Promise<void> {
    await db.delete(mwUro).where(eq(mwUro.entryUuid, entryUuid));
}

