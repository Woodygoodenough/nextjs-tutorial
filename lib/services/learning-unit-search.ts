/**
 * Learning Unit search orchestration.
 *
 * This module is the "service layer" that coordinates:
 * - local DB lookup (stem-anchored)
 * - MW API fetch + parsing (when no local match)
 * - persistence of newly created units + semantic tables
 */
import { InsertMwEntry, InsertLexicalGroup, InsertLexicalGroupEntry, InsertLearningUnit } from "@/lib/db/schema";
import { createMWClientFromEnv } from "@/lib/services/mw-client";
import { parseEntries } from "@/lib/services/mw-parse";
import {
  fetchLearningUnitsFromLookupKey,
  fetchLearningUnitFromLabelAndFingerprint,
  upsertLearningUnit,
  fetchLexicalGroupFromFingerprint,
  upsertUserVocab,
} from "@/lib/services/dao";
import { createHash, randomUUID } from "crypto";
import { GetUnitResult } from "@/lib/types/commons";

function normForCompare(s: string): string {
  // Case-insensitive normalization (China === china).
  // Strip MW formatting markers like '*' so `con*tex*tu*al` matches `contextual`.
  return s.replace(/\*/g, "").normalize("NFC").trim().toLowerCase();
}

function fingerprintFromUuids(entryUuids: string[]): string {
  const joined = Array.from(new Set(entryUuids)).sort().join("|");
  return createHash("sha256").update(joined).digest("hex");
}

function pickRepresentation(entries: Array<InsertMwEntry>, lookupKeyNorm: string) {
  const headwordIdx = entries.findIndex((e) => normForCompare(e.headwordRaw ?? "") === lookupKeyNorm);
  if (headwordIdx !== -1) {
    const entry = entries[headwordIdx]!;
    return {
      label: entry.headwordRaw,
      representativeEntryUuid: entry.entryUuid,
      stemId: randomUUID(),
      fallbackWarning: false,
    };
  }

  const stemIdx = entries.findIndex(
    (e) => e.stems && Array.isArray(e.stems) && e.stems.some((s: string) => normForCompare(s) === lookupKeyNorm),
  );
  if (stemIdx !== -1) {
    const entry = entries[stemIdx]!;
    const matchedStem =
      (entry.stems && Array.isArray(entry.stems) && entry.stems.find((s: string) => normForCompare(s) === lookupKeyNorm)) ??
      entry.headwordRaw;
    return {
      label: matchedStem,
      representativeEntryUuid: entry.entryUuid,
      stemId: randomUUID(),
      fallbackWarning: false,
    };
  }

  const entry = entries[0]!;
  return {
    label: entry.headwordRaw,
    representativeEntryUuid: entry.entryUuid,
    stemId: randomUUID(),
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
      return { status: "existing", unit: existingUnit };
    }
    const groupEntries: Array<InsertLexicalGroupEntry> = entries.map((e, i) => ({
      groupId: existingLexicalGroup.groupId,
      entryUuid: e.entryUuid,
      rank: i,
    }));
    const newUnit: InsertLearningUnit = {
      unitId: randomUUID(),
      stemId: rep.stemId,
      groupId: existingLexicalGroup.groupId,
      label: rep.label,
      representativeEntryUuid: rep.representativeEntryUuid,
      createdFromLookupKey: lookupKeyNorm,
      createdAt: new Date(),
    };
    return { status: "new_in_existing_group", unit: newUnit, entries, groupEntries, lookupKeyNorm };
  }

  const newGroupId = randomUUID();
  const newUnit: InsertLearningUnit = {
    unitId: randomUUID(),
    stemId: rep.stemId,
    groupId: newGroupId,
    label: rep.label,
    representativeEntryUuid: rep.representativeEntryUuid,
    createdFromLookupKey: lookupKeyNorm,
    createdAt: new Date(),
  };
  const newGroup: InsertLexicalGroup = {
    groupId: newGroupId,
    fingerprint,
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
  const candidates = await fetchLearningUnitsFromLookupKey(lookupKeyNorm);
  if (candidates.length === 1) {
    return { status: "existing", unit: candidates[0]! };
  }
  if (candidates.length > 1) {
    return { status: "candidates", candidates, lookupKeyNorm };
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

export async function persistSearchResult(result: GetUnitResult): Promise<void> {
  return upsertLearningUnit(result);
}

export async function addToUserVocab(userId: string, unitId: string): Promise<void> {
  await upsertUserVocab(userId, unitId, 0, null);
}

