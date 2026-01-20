import { eq } from "drizzle-orm";
import { mwDro } from "@/app/lib/db/schema";
import type { SelectMwDro, InsertMwDro } from "@/app/lib/db/schema";
import { db } from "@/app/lib/db/client";

/**
 * Fetch all DROs for a given entry UUID, ordered by rank.
 */
export async function fetchDrosByEntryUuid(entryUuid: string): Promise<SelectMwDro[]> {
    return await db
        .select()
        .from(mwDro)
        .where(eq(mwDro.entryUuid, entryUuid))
        .orderBy(mwDro.rank);
}

/**
 * Fetch a single DRO by its ID.
 */
export async function fetchDroById(droId: string): Promise<SelectMwDro | null> {
    const rows = await db
        .select()
        .from(mwDro)
        .where(eq(mwDro.droId, droId))
        .limit(1);
    return rows[0] ?? null;
}

/**
 * Fetch DROs by DRP (defined run-on phrase) text.
 */
export async function fetchDrosByDrp(drp: string): Promise<SelectMwDro[]> {
    return await db
        .select()
        .from(mwDro)
        .where(eq(mwDro.drp, drp))
        .orderBy(mwDro.rank);
}

/**
 * Insert a single DRO. Uses onConflictDoNothing to handle duplicates.
 */
export async function insertDro(dro: InsertMwDro): Promise<void> {
    await db
        .insert(mwDro)
        .values(dro)
        .onConflictDoNothing({ target: [mwDro.entryUuid, mwDro.rank] });
}

/**
 * Insert multiple DROs in a batch. Uses onConflictDoNothing to handle duplicates.
 */
export async function insertDros(dros: InsertMwDro[]): Promise<void> {
    if (dros.length === 0) return;
    await db
        .insert(mwDro)
        .values(dros)
        .onConflictDoNothing({ target: [mwDro.entryUuid, mwDro.rank] });
}

/**
 * Upsert a DRO. Updates if conflict on (entryUuid, rank), otherwise inserts.
 */
export async function upsertDro(dro: InsertMwDro): Promise<void> {
    await db
        .insert(mwDro)
        .values(dro)
        .onConflictDoUpdate({
            target: [mwDro.entryUuid, mwDro.rank],
            set: {
                drp: dro.drp,
                def: dro.def,
                fetchedAt: dro.fetchedAt,
            },
        });
}

/**
 * Delete all DROs for a given entry UUID.
 */
export async function deleteDrosByEntryUuid(entryUuid: string): Promise<void> {
    await db.delete(mwDro).where(eq(mwDro.entryUuid, entryUuid));
}
