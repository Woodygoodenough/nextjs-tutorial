import { and, eq } from "drizzle-orm";
import { lexicalGroup, learningUnit, lookupKey, mwEntry, lexicalGroupEntry, userVocab } from "@/app/lib/db/schema";
import type { SelectLearningUnit, SelectLexicalGroup } from "@/app/lib/db/schema";
import { GetUnitResult } from "@/app/lib/types/commons";
import { getNextReviewDate, Mastery } from "@/domain/review/scheduler";
import { DEFAULT_REVIEW_SETTINGS } from "@/domain/review/reviewSettings";
import { db } from "@/app/lib/db/client";

export async function fetchLearningUnitFromLookupKey(key: string): Promise<SelectLearningUnit | null> {
    const mapping = await db
        .select({ unitId: lookupKey.unitId })
        .from(lookupKey)
        .where(eq(lookupKey.lookupKey, key))
        .limit(1);

    const unitId = mapping[0]?.unitId;
    if (!unitId) return null;

    const units = await db
        .select()
        .from(learningUnit)
        .where(eq(learningUnit.unitId, unitId))
        .limit(1);

    return units[0] ?? null;
}

export async function fetchLearningUnitFromLabelAndFingerprint(label: string, fingerprint: string): Promise<SelectLearningUnit | null> {
    const lexicalGroup = await fetchLexicalGroupFromFingerprint(fingerprint);
    if (!lexicalGroup) return null;

    const units = await db
        .select()
        .from(learningUnit)
        .where(and(eq(learningUnit.label, label), eq(learningUnit.groupId, lexicalGroup.groupId)))
        .limit(1);

    return units[0] ?? null;
}

export async function fetchLexicalGroupFromFingerprint(fingerprint: string): Promise<SelectLexicalGroup | null> {
    const rows = await db
        .select()
        .from(lexicalGroup)
        .where(eq(lexicalGroup.fingerprint, fingerprint))
        .limit(1);
    return rows[0] ?? null;
}

// we should isolate roles with behavior boundaries

// learning unit exists, so we only need to upsert the lookup key
// notice we export here because this is a separate ui boundary
// where we choose to silently upsert when only a lookup key is required for update
export async function upsertLookupKey(key: string, unitId: string): Promise<void> {
    await db
        .insert(lookupKey)
        .values({ lookupKey: key, unitId })
        .onConflictDoNothing({ target: lookupKey.lookupKey });
}


export async function upsertLearningUnit(result: GetUnitResult): Promise<void> {
    if (result.status !== "new_in_existing_group" && result.status !== "new_with_new_group") {
        return;
    }

    await db.transaction(async (tx) => {
        if (result.status === "new_with_new_group") {
            // 1) group: should be unique by fingerprint (recommended)
            await tx
                .insert(lexicalGroup)
                .values(result.group)
                .onConflictDoNothing({ target: lexicalGroup.fingerprint }); // requires UNIQUE(fingerprint)

            // IMPORTANT: if conflict happened, your randomly generated groupId may not be the real one.
            // So you must re-fetch the canonical groupId by fingerprint.
            const g = await tx
                .select({ groupId: lexicalGroup.groupId })
                .from(lexicalGroup)
                .where(eq(lexicalGroup.fingerprint, result.group.fingerprint))
                .limit(1);

            const canonicalGroupId = g[0]?.groupId;
            if (!canonicalGroupId) throw new Error("Failed to get lexicalGroup after upsert");

            // overwrite IDs in memory for downstream inserts
            result.unit.groupId = canonicalGroupId;
            for (const ge of result.groupEntries) ge.groupId = canonicalGroupId;
        }

        // 2) entries: unique by entryUuid (recommended)
        if (result.status === "new_with_new_group") {
            await tx
                .insert(mwEntry)
                .values(result.entries)
                .onConflictDoNothing({ target: mwEntry.entryUuid });

            // 3) group entries: PK(groupId, entryUuid)
            await tx
                .insert(lexicalGroupEntry)
                .values(result.groupEntries)
                .onConflictDoNothing(); // composite PK handles it
        }

        // 4) learning unit: needs a uniqueness definition
        // If unitId is randomUUID, conflict won't happen unless you re-run same unitId.
        // Better: add UNIQUE(label, groupId) or UNIQUE(label, fingerprint) depending on schema design.
        await tx
            .insert(learningUnit)
            .values(result.unit)
            .onConflictDoNothing({ target: learningUnit.unitId }); // minimally safe

        // 5) lookupKey sync (real upsert)
        await tx
            .insert(lookupKey)
            .values({ lookupKey: result.lookupKeyNorm, unitId: result.unit.unitId })
            .onConflictDoUpdate({
                target: lookupKey.lookupKey,
                set: { unitId: result.unit.unitId },
            });
    });
}

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