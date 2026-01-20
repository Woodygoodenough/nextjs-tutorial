import { InsertMwEntry, InsertLexicalGroup, InsertLexicalGroupEntry, InsertLearningUnit } from "@/app/lib/db/schema";
import { createMWClientFromEnv, parseEntries } from "@/app/lib/services/mwclient";
import { fetchLearningUnitFromLookupKey, fetchLearningUnitFromLabelAndFingerprint, upsertLookupKey, upsertLearningUnit, fetchLexicalGroupFromFingerprint, upsertUserVocab } from "@/app/lib/services/dao";
import { createHash, randomUUID } from "crypto";
import { GetUnitResult } from "@/app/lib/types/commons";

function normForCompare(s: string): string {
    return s.normalize("NFC").trim();
}

function fingerprintFromUuids(entryUuids: string[]): string {
    const joined = Array.from(new Set(entryUuids)).sort().join("|");
    return createHash("sha256").update(joined).digest("hex");
}

function pickRepresentation(
    entries: Array<InsertMwEntry>,
    lookupKeyNorm: string,
) {
    const headwordIdx = entries.findIndex((e) => normForCompare(e.headwordRaw ?? "") === lookupKeyNorm);
    if (headwordIdx !== -1) {
        const entry = entries[headwordIdx]!;
        return {
            label: entry.headwordRaw,
            representativeEntryUuid: entry.entryUuid,
            matchMethod: "HEADWORD",
            fallbackWarning: false,
        };
    }

    const stemIdx = entries.findIndex((e) => e.stems && Array.isArray(e.stems) && e.stems.some((s: string) => normForCompare(s) === lookupKeyNorm));
    if (stemIdx !== -1) {
        const entry = entries[stemIdx]!;
        const matchedStem =
            (entry.stems && Array.isArray(entry.stems) && entry.stems.find((s: string) => normForCompare(s) === lookupKeyNorm)) ?? entry.headwordRaw;
        return {
            label: matchedStem,
            representativeEntryUuid: entry.entryUuid,
            matchMethod: "STEM",
            fallbackWarning: false,
        };
    }

    const entry = entries[0]!;
    return {
        label: entry.headwordRaw,
        representativeEntryUuid: entry.entryUuid,
        matchMethod: "FALLBACK",
        fallbackWarning: true,
    };
}


async function getLearningUnit(entries: Array<InsertMwEntry>, lookupKeyNorm: string): Promise<GetUnitResult> {
    const entryUuids = entries.map((e) => e.entryUuid);
    const fingerprint = fingerprintFromUuids(entryUuids);
    const rep = pickRepresentation(entries, lookupKeyNorm);
    const existingLexicalGroup = await fetchLexicalGroupFromFingerprint(fingerprint);
    if (existingLexicalGroup) {
        const existingUnit = await fetchLearningUnitFromLabelAndFingerprint(rep.label, fingerprint);
        if (existingUnit) {
            return { status: "existing", unit: existingUnit, lookupKeyUpsert: { lookupKeyNorm: lookupKeyNorm, unitId: existingUnit.unitId } };
        }
        const newUnit: InsertLearningUnit = {
            unitId: randomUUID(),
            groupId: existingLexicalGroup.groupId,
            label: rep.label,
            representativeEntryUuid: rep.representativeEntryUuid,
            matchMethod: rep.matchMethod,
            createdFromLookupKey: lookupKeyNorm,
            createdAt: new Date(),
        };
        return { status: "new_in_existing_group", unit: newUnit, lookupKeyNorm: lookupKeyNorm };
    }
    const newGroupId = randomUUID();

    const newUnit: InsertLearningUnit = {
        unitId: randomUUID(),
        groupId: newGroupId,
        label: rep.label,
        representativeEntryUuid: rep.representativeEntryUuid,
        matchMethod: rep.matchMethod,
        createdFromLookupKey: lookupKeyNorm,
        createdAt: new Date(),
    };
    const newGroup: InsertLexicalGroup = {
        groupId: newGroupId,
        fingerprint: fingerprint,
        createdAt: new Date(),
    };


    const newGroupEntries: Array<InsertLexicalGroupEntry> = entries.map((e, i) => ({
        groupId: newGroupId,
        entryUuid: e.entryUuid,
        rank: i,
    }));
    return { status: "new_with_new_group", unit: newUnit, group: newGroup, entries, groupEntries: newGroupEntries, lookupKeyNorm };
}


export async function searchMW(lookupKey: string): Promise<GetUnitResult> {
    const lookupKeyNorm = normForCompare(lookupKey);
    const lookupExisting = await fetchLearningUnitFromLookupKey(lookupKeyNorm);
    if (lookupExisting) {
        return { status: "existing", unit: lookupExisting };
    }
    const client = createMWClientFromEnv();
    const result = await client.fetchWord(lookupKeyNorm);
    if (result.kind !== "entries") {
        console.log(`waiting to be implemented for: ${result.kind}`);
        return { status: "none", reason: `waiting to be implemented for: ${result.kind}` };
    }
    const entries = parseEntries(result.raw);
    return getLearningUnit(entries, lookupKeyNorm);
}


export async function silentlyPersistLookupKey(result: GetUnitResult): Promise<void> {
    if (result.status === "existing" && result.lookupKeyUpsert) {
        await upsertLookupKey(result.lookupKeyUpsert.lookupKeyNorm, result.lookupKeyUpsert.unitId);
    }
    // we do not need to do anything for other cases
    return;
}

export async function persistSearchResult(result: GetUnitResult): Promise<void> {
    return upsertLearningUnit(result);
}


export async function addToUserVocab(userId: string, unitId: string): Promise<void> {
    await upsertUserVocab(userId, unitId, 0, null);
}