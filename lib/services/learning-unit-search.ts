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

function mwDisplayTerm(input: string): string {
  // Strip MW formatting markers like '*' and normalize for display/matching.
  return input.replace(/\*/g, "").normalize("NFC").trim();
}

function isUpperAlpha(ch: string | undefined): boolean {
  return !!ch && ch >= "A" && ch <= "Z";
}

function isLowerAlpha(ch: string | undefined): boolean {
  return !!ch && ch >= "a" && ch <= "z";
}

function canonicalizeLookupFirstLetterCase(display: string): string {
  // Preserve only the first-letter case from the user's input.
  // Everything after the first letter is lowercased to avoid "random caps" affecting behavior.
  const d = mwDisplayTerm(display);
  if (!d) return "";
  const lower = d.toLowerCase();
  return isUpperAlpha(d[0]) ? lower[0]!.toUpperCase() + lower.slice(1) : lower;
}

function pickStemByFirstLetterCase(args: {
  stems: string[];
  lookupLower: string;
  preferUpperFirst: boolean;
}): string | null {
  const matches = args.stems
    .map((raw, i) => ({ raw, i, display: mwDisplayTerm(raw), lower: mwDisplayTerm(raw).toLowerCase() }))
    .filter((x) => x.lower === args.lookupLower);
  if (matches.length === 0) return null;

  if (args.preferUpperFirst) {
    const upper = matches.find((m) => isUpperAlpha(m.display[0]));
    if (upper) return upper.raw;
  } else {
    const lower = matches.find((m) => isLowerAlpha(m.display[0]));
    if (lower) return lower.raw;
  }

  return matches[0]!.raw;
}

function fingerprintFromUuids(entryUuids: string[]): string {
  const joined = Array.from(new Set(entryUuids)).sort().join("|");
  return createHash("sha256").update(joined).digest("hex");
}

function pickRepresentation(args: {
  entries: Array<InsertMwEntry>;
  lookupLower: string;
  preferUpperFirst: boolean;
}) {
  // MW API normalizes queries, but meta.stems[] preserves case variants (Mercury vs mercury).
  // We only care about first-letter case (not random internal capitalization).
  const entries = args.entries;

  for (const entry of entries) {
    const stems = Array.isArray(entry.stems) ? (entry.stems as any[]).filter((s) => typeof s === "string") : [];
    const matched = pickStemByFirstLetterCase({
      stems: stems as string[],
      lookupLower: args.lookupLower,
      preferUpperFirst: args.preferUpperFirst,
    });
    if (matched) {
      return {
        label: mwDisplayTerm(matched),
        representativeEntryUuid: entry.entryUuid,
        stemId: randomUUID(),
        fallbackWarning: false,
      };
    }
  }

  // If we didn't find the lookup key in stems, pick the first entry and use its display headword.
  const entry = entries[0]!;
  const label =
    typeof entry.headwordRaw === "string" && entry.headwordRaw.trim()
      ? mwDisplayTerm(entry.headwordRaw)
      : (() => {
          const stems = Array.isArray(entry.stems) ? (entry.stems as any[]).filter((s) => typeof s === "string") : [];
          const first = (stems as string[])[0];
          return first ? mwDisplayTerm(first) : "";
        })();

  return {
    label,
    representativeEntryUuid: entry.entryUuid,
    stemId: randomUUID(),
    fallbackWarning: true,
  };
}

async function getLearningUnit(args: {
  entries: Array<InsertMwEntry>;
  lookupLower: string;
  lookupCaseKey: string;
  preferUpperFirst: boolean;
}): Promise<GetUnitResult> {
  const { entries } = args;
  const entryUuids = entries.map((e) => e.entryUuid);
  const fingerprint = fingerprintFromUuids(entryUuids);
  const rep = pickRepresentation({
    entries,
    lookupLower: args.lookupLower,
    preferUpperFirst: args.preferUpperFirst,
  });

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
      createdFromLookupKey: args.lookupCaseKey,
      createdAt: new Date(),
    };
    return { status: "new_in_existing_group", unit: newUnit, entries, groupEntries, lookupKeyNorm: args.lookupLower };
  }

  const newGroupId = randomUUID();
  const newUnit: InsertLearningUnit = {
    unitId: randomUUID(),
    stemId: rep.stemId,
    groupId: newGroupId,
    label: rep.label,
    representativeEntryUuid: rep.representativeEntryUuid,
    createdFromLookupKey: args.lookupCaseKey,
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
  return {
    status: "new_with_new_group",
    unit: newUnit,
    group: newGroup,
    entries,
    groupEntries: newGroupEntries,
    lookupKeyNorm: args.lookupLower,
  };
}

export async function searchMW(lookupKey: string): Promise<GetUnitResult> {
  const inputDisplay = mwDisplayTerm(lookupKey);
  const lookupCaseKey = canonicalizeLookupFirstLetterCase(inputDisplay);
  const lookupLower = lookupCaseKey.toLowerCase();
  const preferUpperFirst = isUpperAlpha(lookupCaseKey[0]);

  // Local lookup is always by stem_norm (lowercase), but selection/presentation respects meta.stems[] casing.
  const candidates = await fetchLearningUnitsFromLookupKey(lookupLower);
  if (candidates.length === 1) {
    return { status: "existing", unit: candidates[0]! };
  }
  if (candidates.length > 1) {
    return { status: "candidates", candidates, lookupKeyNorm: lookupLower };
  }

  const client = createMWClientFromEnv();
  const result = await client.fetchWord(lookupLower);
  if (result.kind !== "entries") {
    console.log(`waiting to be implemented for: ${result.kind}`);
    return { status: "none", reason: `waiting to be implemented for: ${result.kind}` };
  }

  const entries = parseEntries(result.raw);
  return getLearningUnit({ entries, lookupLower, lookupCaseKey, preferUpperFirst });
}

export async function persistSearchResult(result: GetUnitResult): Promise<void> {
  return upsertLearningUnit(result);
}

export async function addToUserVocab(userId: string, unitId: string): Promise<void> {
  await upsertUserVocab(userId, unitId, 0, null);
}

