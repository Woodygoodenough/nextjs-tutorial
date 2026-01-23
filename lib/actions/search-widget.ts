"use server";

import { sql } from "@/lib/db/client";
import { fetchLearningUnitSummariesByQuery, fetchLearningUnitSummaryByUnitId, fetchLearningUnitStemInfoByUnitIds, upsertUserVocab } from "@/lib/services/dao";
import { persistSearchResult, searchMW } from "@/lib/services/learning-unit-search";
import type { Mastery } from "@/domain/review/scheduler";
import { requireUserId } from "@/lib/actions/require-user-id";

export type SearchWidgetResult = {
  unitId: string;
  label: string;
  stem: string | null;
  anchorKind: string | null;
};

export type SearchWidgetEntry = {
  entryUuid: string;
  headwordRaw: string | null;
  metaId: string | null;
};

export type SearchWidgetResolved = SearchWidgetResult & {
  entries: Array<SearchWidgetEntry>;
  inLibrary: boolean;
};

export type SearchAndResolveResult =
  | { kind: "resolved"; resolved: SearchWidgetResolved }
  | { kind: "candidates"; candidates: Array<SearchWidgetResult> };

function norm(s: string): string {
  return s.normalize("NFC").trim().toLowerCase();
}

export async function searchExistingUnits(query: string): Promise<Array<SearchWidgetResult>> {
  const q = query.trim();
  if (!q) return [];

  // DB-only search (no MW fetch). Pull a larger candidate set, then rank in JS.
  const rows = await fetchLearningUnitSummariesByQuery({ query: q, limit: 25 });

  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    if (seen.has(r.unitId)) return false;
    seen.add(r.unitId);
    return true;
  });

  const qn = norm(q);
  unique.sort((a, b) => {
    const al = norm(a.label ?? "");
    const bl = norm(b.label ?? "");

    const aExact = al === qn ? 1 : 0;
    const bExact = bl === qn ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;

    const aPrefix = al.startsWith(qn) ? 1 : 0;
    const bPrefix = bl.startsWith(qn) ? 1 : 0;
    if (aPrefix !== bPrefix) return bPrefix - aPrefix;

    const aLen = a.label?.length ?? 0;
    const bLen = b.label?.length ?? 0;
    if (aLen !== bLen) return aLen - bLen;

    const at = a.createdAt?.getTime?.() ?? 0;
    const bt = b.createdAt?.getTime?.() ?? 0;
    return bt - at;
  });

  return unique.slice(0, 3).map((r) => ({
    unitId: r.unitId,
    label: r.label,
    stem: r.stem ?? null,
    anchorKind: r.anchorKind ?? null,
  }));
}

async function isInUserLibrary(userId: string, unitId: string): Promise<boolean> {
  const rows = await sql<Array<{ ok: number }>>`
    select 1 as ok
    from user_vocab
    where user_id = ${userId} and unit_id = ${unitId}
    limit 1;
  `;
  return !!rows[0]?.ok;
}

async function fetchTopEntriesForUnit(unitId: string): Promise<Array<SearchWidgetEntry>> {
  const rows = await sql<Array<SearchWidgetEntry>>`
    select
      e.entry_uuid as "entryUuid",
      e.headword_raw as "headwordRaw",
      e.meta_id as "metaId"
    from learning_unit u
    join lexical_group_entry ge on ge.group_id = u.group_id
    join mw_entry e on e.entry_uuid = ge.entry_uuid
    where u.unit_id = ${unitId}
    order by ge.rank asc
    limit 3;
  `;
  return rows;
}

export async function addExistingUnitToLibrary(unitId: string): Promise<void> {
  const userId = await requireUserId();
  await upsertUserVocab(userId, unitId, 0, null as Mastery);
}

export async function resolveExistingUnit(unitId: string): Promise<SearchWidgetResolved> {
  const userId = await requireUserId();
  const unit = await fetchLearningUnitSummaryByUnitId(unitId);
  if (!unit) throw new Error("Learning unit not found");

  const entries = await fetchTopEntriesForUnit(unit.unitId);
  const inLibrary = await isInUserLibrary(userId, unit.unitId);

  return {
    unitId: unit.unitId,
    label: unit.label,
    stem: unit.stem ?? null,
    anchorKind: unit.anchorKind ?? null,
    entries,
    inLibrary,
  };
}

export async function searchAndResolve(query: string): Promise<SearchAndResolveResult> {
  const userId = await requireUserId();

  const result = await searchMW(query);
  await persistSearchResult(result);

  if (result.status === "none") {
    throw new Error(result.reason);
  }
  if (result.status === "candidates") {
    const ids = result.candidates.map((u) => u.unitId);
    const stemInfo = await fetchLearningUnitStemInfoByUnitIds(ids);
    return {
      kind: "candidates",
      candidates: result.candidates.map((u) => ({
        unitId: u.unitId,
        label: u.label,
        stem: stemInfo.get(u.unitId)?.stem ?? null,
        anchorKind: stemInfo.get(u.unitId)?.anchorKind ?? null,
      })),
    };
  }

  const unitId = result.unit.unitId;
  const label = result.unit.label ?? "";

  const entries = await fetchTopEntriesForUnit(unitId);
  const inLibrary = await isInUserLibrary(userId, unitId);

  // Reuse the resolver so we always return the same shape (incl. stem + anchorKind).
  const resolved = await resolveExistingUnit(unitId);
  return { kind: "resolved", resolved: { ...resolved, entries, inLibrary } };
}

