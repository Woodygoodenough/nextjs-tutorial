"use server";

import { db, sql } from "@/lib/db/client";
import { userVocab } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { requireUserId } from "./require-user-id";

function mwDisplayTerm(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(/\*/g, "").normalize("NFC").trim();
}

export type LibraryUnit = {
  unitId: string;
  label: string;
  anchorKind: string | null;
  stem: string | null;
  soundAudio: string | null;
  progress: number;
  lastReviewedAt: Date | null;
  shortdef: string | null;
};

export type LibraryPageResult = {
  units: LibraryUnit[];
  total: number;
  page: number;
  totalPages: number;
};

export type WordDetail = {
  unitId: string;
  label: string;
  anchorKind: string | null;
  progress: number;
  lastReviewedAt: Date | null;
  shortdef: string | null;
  headwordRaw: string | null;
  metaId: string | null;
  groupId: string;
  stemId: string;
  selectedStem: {
    entryUuid: string;
    rank: number;
    stem: string;
    stemNorm: string;
    anchorKind: string;
    fallbackWarning: boolean;
    soundAudio: string | null;
  };
  entries: Array<{
    entryUuid: string;
    groupRank: number;
    metaId: string | null;
    headwordRaw: string | null;
    hwiHw: string | null;
    /** Entry-title pronunciation (HWI owner). */
    hwiSoundAudio: string | null;
    /** Preferred entry title term (derived from meta.stems[] + headword). */
    titleStem: string | null;
    stems: Array<{
      stemId: string;
      rank: number;
      stem: string;
      stemNorm: string;
      anchorKind: string;
      anchorId: string | null;
      anchorText: string | null;
      fallbackWarning: boolean;
      isUnitStem: boolean;
      soundAudio: string | null;
    }>;
    definitions: {
      scopes: Array<{
        scopeType: "ENTRY" | "DRO";
        scopeId: string;
        label: string | null; // DRO phrase (drp) when available
        senses: Array<{
          senseId: string;
          kind: string;
          sn: string | null;
          vd: string | null;
          depth: number;
          rank: number;
          dt: Array<{
            dtId: string;
            dtType: string;
            rank: number;
            text: string | null;
            payload: any | null;
          }>;
        }>;
      }>;
    };
  }>;
};

export async function getUserLibraryUnits(
  searchQuery: string = "",
  page: number = 1,
  pageSize: number = 10
): Promise<LibraryPageResult> {
  const userId = await requireUserId();
  const offset = (page - 1) * pageSize;
  const searchTerm = searchQuery.trim();

  // Use SQL for complex query with joins and search
  if (searchTerm) {
    const countRows = await sql<Array<{ total: number }>>`
      SELECT COUNT(DISTINCT uv.unit_id)::int as total
      FROM user_vocab uv
      INNER JOIN learning_unit lu ON uv.unit_id = lu.unit_id
      LEFT JOIN mw_stem ms ON lu.stem_id = ms.stem_id
      WHERE uv.user_id = ${userId}
        AND (lu.label ILIKE ${`%${searchTerm}%`} OR ms.stem ILIKE ${`%${searchTerm}%`} OR ms.stem_norm ILIKE ${`%${searchTerm}%`})
    `;

    const unitsRows = await sql<Array<{
      unit_id: string;
      label: string;
      anchor_kind: string | null;
      stem: string | null;
      sound_audio: string | null;
      progress: number;
      last_reviewed_at: Date | null;
      shortdef: string | null;
    }>>`
      SELECT
        lu.unit_id as unit_id,
        lu.label as label,
        ms.anchor_kind as anchor_kind,
        ms.stem as stem,
        pr.sound_audio as sound_audio,
        uv.progress as progress,
        uv.last_reviewed_at as last_reviewed_at,
        defn.text as shortdef
      FROM user_vocab uv
      INNER JOIN learning_unit lu ON uv.unit_id = lu.unit_id
      LEFT JOIN mw_stem ms ON lu.stem_id = ms.stem_id
      LEFT JOIN LATERAL (
        SELECT p.sound_audio
        FROM mw_pronunciation p
        WHERE p.owner_type = ms.anchor_kind
          AND p.owner_id = ms.anchor_id
          AND p.sound_audio IS NOT NULL
        ORDER BY p.rank ASC
        LIMIT 1
      ) pr ON true
      LEFT JOIN LATERAL (
        SELECT d.text
        FROM mw_sense s
        INNER JOIN mw_sense_dt d ON d.sense_id = s.sense_id
        WHERE s.entry_uuid = lu.representative_entry_uuid
          AND s.scope_type = 'ENTRY'
          AND s.scope_id = (lu.representative_entry_uuid::text)
          AND d.dt_type = 'text'
          AND d.text IS NOT NULL
        ORDER BY s.rank ASC, d.rank ASC
        LIMIT 1
      ) defn ON true
      WHERE uv.user_id = ${userId}
        AND (lu.label ILIKE ${`%${searchTerm}%`} OR ms.stem ILIKE ${`%${searchTerm}%`} OR ms.stem_norm ILIKE ${`%${searchTerm}%`})
      ORDER BY uv.last_reviewed_at DESC NULLS LAST, lu.created_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;

    const total = Number(countRows[0]?.total ?? 0);
    const totalPages = Math.ceil(total / pageSize);

    return {
      units: unitsRows.map((u) => {
        let shortdef = u.shortdef?.trim() ?? null;
        if (shortdef && shortdef.length > 150) shortdef = shortdef.substring(0, 147) + "...";
        return {
          unitId: u.unit_id,
          label: (u.stem ?? u.label),
          anchorKind: u.anchor_kind ?? null,
          stem: u.stem ?? null,
          soundAudio: u.sound_audio ?? null,
          progress: u.progress,
          lastReviewedAt: u.last_reviewed_at,
          shortdef: shortdef || null,
        };
      }),
      total,
      page,
      totalPages,
    };
  } else {
    // No search - simpler query
    const countResult = await db
      .select({ total: count() })
      .from(userVocab)
      .where(eq(userVocab.userId, userId));

    const total = Number(countResult[0]?.total ?? 0);
    const totalPages = Math.ceil(total / pageSize);

    // Fetch with progress, lastReviewedAt, and shortdef
    const unitsRows = await sql<Array<{
      unit_id: string;
      label: string;
      anchor_kind: string | null;
      stem: string | null;
      sound_audio: string | null;
      progress: number;
      last_reviewed_at: Date | null;
      shortdef: string | null;
    }>>`
      SELECT
        lu.unit_id as unit_id,
        lu.label as label,
        ms.anchor_kind as anchor_kind,
        ms.stem as stem,
        pr.sound_audio as sound_audio,
        uv.progress as progress,
        uv.last_reviewed_at as last_reviewed_at,
        defn.text as shortdef
      FROM user_vocab uv
      INNER JOIN learning_unit lu ON uv.unit_id = lu.unit_id
      LEFT JOIN mw_stem ms ON lu.stem_id = ms.stem_id
      LEFT JOIN LATERAL (
        SELECT p.sound_audio
        FROM mw_pronunciation p
        WHERE p.owner_type = ms.anchor_kind
          AND p.owner_id = ms.anchor_id
          AND p.sound_audio IS NOT NULL
        ORDER BY p.rank ASC
        LIMIT 1
      ) pr ON true
      LEFT JOIN LATERAL (
        SELECT d.text
        FROM mw_sense s
        INNER JOIN mw_sense_dt d ON d.sense_id = s.sense_id
        WHERE s.entry_uuid = lu.representative_entry_uuid
          AND s.scope_type = 'ENTRY'
          AND s.scope_id = (lu.representative_entry_uuid::text)
          AND d.dt_type = 'text'
          AND d.text IS NOT NULL
        ORDER BY s.rank ASC, d.rank ASC
        LIMIT 1
      ) defn ON true
      WHERE uv.user_id = ${userId}
      ORDER BY uv.last_reviewed_at DESC NULLS LAST, lu.created_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;

    return {
      units: unitsRows.map((u) => {
        let shortdef = u.shortdef?.trim() ?? null;
        if (shortdef && shortdef.length > 150) shortdef = shortdef.substring(0, 147) + "...";
        return {
          unitId: u.unit_id,
          label: (u.stem ?? u.label),
          anchorKind: u.anchor_kind ?? null,
          stem: u.stem ?? null,
          soundAudio: u.sound_audio ?? null,
          progress: u.progress,
          lastReviewedAt: u.last_reviewed_at,
          shortdef: shortdef || null,
        };
      }),
      total,
      page,
      totalPages,
    };
  }
}

export async function getWordDetail(unitId: string): Promise<WordDetail | null> {
  const userId = await requireUserId();

  const rows = await sql<Array<{
    unit_id: string;
    label: string;
    anchor_kind: string | null;
    group_id: string;
    stem_id: string;
    representative_entry_uuid: string;
    progress: number;
    last_reviewed_at: Date | null;
    shortdef: string | null;
    headword_raw: string | null;
    meta_id: string | null;
    selected_stem_entry_uuid: string;
    selected_stem_rank: number;
    selected_stem: string;
    selected_stem_norm: string;
    selected_stem_anchor_kind: string;
    selected_stem_anchor_id: string | null;
    selected_stem_fallback_warning: boolean;
  }>>`
    SELECT
      lu.unit_id as unit_id,
      lu.label as label,
      ms.anchor_kind as anchor_kind,
      lu.group_id as group_id,
      lu.stem_id as stem_id,
      lu.representative_entry_uuid as representative_entry_uuid,
      uv.progress as progress,
      uv.last_reviewed_at as last_reviewed_at,
      defn.text as shortdef,
      me.headword_raw as headword_raw,
      me.meta_id as meta_id,
      ms.entry_uuid as selected_stem_entry_uuid,
      ms.rank as selected_stem_rank,
      ms.stem as selected_stem,
      ms.stem_norm as selected_stem_norm,
      ms.anchor_kind as selected_stem_anchor_kind,
      ms.anchor_id as selected_stem_anchor_id,
      ms.fallback_warning as selected_stem_fallback_warning
    FROM user_vocab uv
    INNER JOIN learning_unit lu ON uv.unit_id = lu.unit_id
    LEFT JOIN mw_stem ms ON lu.stem_id = ms.stem_id
    LEFT JOIN mw_entry me ON lu.representative_entry_uuid = me.entry_uuid
    LEFT JOIN LATERAL (
      SELECT d.text
      FROM mw_sense s
      INNER JOIN mw_sense_dt d ON d.sense_id = s.sense_id
      WHERE s.entry_uuid = lu.representative_entry_uuid
        AND s.scope_type = 'ENTRY'
        AND s.scope_id = (lu.representative_entry_uuid::text)
        AND d.dt_type = 'text'
        AND d.text IS NOT NULL
      ORDER BY s.rank ASC, d.rank ASC
      LIMIT 1
    ) defn ON true
    WHERE uv.user_id = ${userId} AND lu.unit_id = ${unitId}
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const u = rows[0];

  let shortdef = u.shortdef?.trim() ?? null;

  // Fetch the full lexical group (entries + stems), ordered by group rank,
  // but render the entry containing the selected stem first for UX.
  const groupEntries = await sql<Array<{
    entry_uuid: string;
    group_rank: number;
    meta_id: string | null;
    headword_raw: string | null;
    hwi_hw: string | null;
  }>>`
    SELECT
      lge.entry_uuid as entry_uuid,
      lge.rank as group_rank,
      me.meta_id as meta_id,
      me.headword_raw as headword_raw,
      mh.hw as hwi_hw
    FROM lexical_group_entry lge
    INNER JOIN mw_entry me ON lge.entry_uuid = me.entry_uuid
    LEFT JOIN mw_hwi mh ON mh.entry_uuid = me.entry_uuid
    WHERE lge.group_id = ${u.group_id}
    ORDER BY lge.rank ASC
  `;

  const entryUuids = groupEntries.map((e) => e.entry_uuid);

  const stemRows =
    entryUuids.length === 0
      ? []
      : await sql<Array<{
          stem_id: string;
          entry_uuid: string;
          stem: string;
          stem_norm: string;
          anchor_kind: string;
          anchor_id: string | null;
          fallback_warning: boolean;
          rank: number;
        }>>`
          SELECT
            ms.stem_id as stem_id,
            ms.entry_uuid as entry_uuid,
            ms.stem as stem,
            ms.stem_norm as stem_norm,
            ms.anchor_kind as anchor_kind,
            ms.anchor_id as anchor_id,
            ms.fallback_warning as fallback_warning,
            ms.rank as rank
          FROM mw_stem ms
          WHERE ms.entry_uuid = ANY(${sql.array(entryUuids, 2950)})
          ORDER BY ms.entry_uuid ASC, ms.rank ASC
        `;

  // Best-effort human-friendly anchor labels (no raw_json; only persisted tables).
  const idsByKind = {
    DRO: new Set<string>(),
    URO: new Set<string>(),
    AHW: new Set<string>(),
    VRS: new Set<string>(),
    INS: new Set<string>(),
  };
  for (const s of stemRows) {
    const id = s.anchor_id;
    if (!id) continue;
    if (s.anchor_kind === "DRO") idsByKind.DRO.add(id);
    if (s.anchor_kind === "URO") idsByKind.URO.add(id);
    if (s.anchor_kind === "AHW") idsByKind.AHW.add(id);
    if (s.anchor_kind === "VRS") idsByKind.VRS.add(id);
    if (s.anchor_kind === "INS") idsByKind.INS.add(id);
  }

  const droIds = Array.from(idsByKind.DRO);
  const uroIds = Array.from(idsByKind.URO);
  const ahwIds = Array.from(idsByKind.AHW);
  const vrIds = Array.from(idsByKind.VRS);
  const inIds = Array.from(idsByKind.INS);

  const [droRows, uroRows, ahwRows, vrRows, inRows] = await Promise.all([
    droIds.length
      ? sql<Array<{ dro_id: string; drp: string }>>`
          SELECT dro_id, drp FROM mw_dro WHERE dro_id = ANY(${sql.array(droIds, 2950)})
        `
      : Promise.resolve([]),
    uroIds.length
      ? sql<Array<{ uro_id: string; ure: string; fl: string }>>`
          SELECT uro_id, ure, fl FROM mw_uro WHERE uro_id = ANY(${sql.array(uroIds, 2950)})
        `
      : Promise.resolve([]),
    ahwIds.length
      ? sql<Array<{ ahw_id: string; hw: string }>>`
          SELECT ahw_id, hw FROM mw_ahw WHERE ahw_id = ANY(${sql.array(ahwIds, 2950)})
        `
      : Promise.resolve([]),
    vrIds.length
      ? sql<Array<{ vr_id: string; va: string; vl: string | null; scope_type: string }>>`
          SELECT vr_id, va, vl, scope_type FROM mw_vr WHERE vr_id = ANY(${sql.array(vrIds, 2950)})
        `
      : Promise.resolve([]),
    inIds.length
      ? sql<Array<{ in_id: string; inflection: string | null; ifc: string | null; il: string | null; scope_type: string }>>`
          SELECT in_id, "if" as inflection, ifc, il, scope_type FROM mw_in WHERE in_id = ANY(${sql.array(inIds, 2950)})
        `
      : Promise.resolve([]),
  ]);

  const anchorTextById = new Map<string, string>();
  for (const d of droRows) anchorTextById.set(d.dro_id, d.drp);
  for (const u2 of uroRows) anchorTextById.set(u2.uro_id, `${u2.ure}${u2.fl ? ` (${u2.fl})` : ""}`);
  for (const a of ahwRows) anchorTextById.set(a.ahw_id, a.hw);
  for (const v of vrRows) anchorTextById.set(v.vr_id, `${v.va}${v.vl ? ` [${v.vl}]` : ""} · ${v.scope_type}`);
  for (const i of inRows) {
    const base = i.inflection ?? i.ifc ?? "";
    const lbl = i.il ? ` [${i.il}]` : "";
    anchorTextById.set(i.in_id, `${base}${lbl}${i.scope_type ? ` · ${i.scope_type}` : ""}`);
  }

  const entryByUuid = new Map<
    string,
    {
      entryUuid: string;
      groupRank: number;
      metaId: string | null;
      headwordRaw: string | null;
      hwiHw: string | null;
      hwiSoundAudio: string | null;
      titleStem: string | null;
      stems: WordDetail["entries"][number]["stems"];
      definitions: WordDetail["entries"][number]["definitions"];
    }
  >();

  for (const e of groupEntries) {
    entryByUuid.set(e.entry_uuid, {
      entryUuid: e.entry_uuid,
      groupRank: e.group_rank,
      metaId: e.meta_id,
      headwordRaw: e.headword_raw,
      hwiHw: e.hwi_hw,
      hwiSoundAudio: null,
      titleStem: null,
      stems: [],
      definitions: { scopes: [] },
    });
  }

  for (const s of stemRows) {
    const entry = entryByUuid.get(s.entry_uuid);
    if (!entry) continue;
    entry.stems.push({
      stemId: s.stem_id,
      rank: s.rank,
      stem: s.stem,
      stemNorm: s.stem_norm,
      anchorKind: s.anchor_kind,
      anchorId: s.anchor_id,
      anchorText:
        s.anchor_kind === "HWI"
          ? entry.hwiHw ?? entry.headwordRaw
          : s.anchor_id
            ? anchorTextById.get(s.anchor_id) ?? null
            : null,
      fallbackWarning: s.fallback_warning,
      isUnitStem: s.stem_id === u.stem_id,
      soundAudio: null,
    });
  }

  // Pronunciations for stems: first audio per (owner_type, owner_id)
  const ownerIdsByType = new Map<string, Set<string>>();

  // Entry titles are headwords (HWI). Always include HWI owners for each entry.
  // This is not a fallback behavior; it reflects the actual MW structure.
  if (entryUuids.length > 0) {
    ownerIdsByType.set("HWI", new Set(entryUuids));
  }

  for (const e of entryByUuid.values()) {
    for (const s of e.stems) {
      if (!s.anchorId) continue;
      if (!s.anchorKind || s.anchorKind === "UNKNOWN") continue;
      if (s.anchorKind === "HWI") continue; // already covered by entryUuids above
      const set = ownerIdsByType.get(s.anchorKind) ?? new Set<string>();
      set.add(s.anchorId);
      ownerIdsByType.set(s.anchorKind, set);
    }
  }

  const ownerAudio = new Map<string, string>(); // `${type}:${id}` -> sound_audio
  const fetchAudioForType = async (ownerType: string, ids: string[]) => {
    if (ids.length === 0) return;
    const rows = await sql<Array<{ owner_id: string; sound_audio: string }>>`
      SELECT owner_id, sound_audio
      FROM mw_pronunciation
      WHERE owner_type = ${ownerType}
        AND owner_id = ANY(${sql.array(ids, 25)})
        AND sound_audio IS NOT NULL
      ORDER BY owner_id ASC, rank ASC
    `;
    for (const r of rows) {
      const k = `${ownerType}:${r.owner_id}`;
      if (!ownerAudio.has(k)) ownerAudio.set(k, r.sound_audio);
    }
  };

  await Promise.all(
    Array.from(ownerIdsByType.entries()).map(([t, set]) => fetchAudioForType(t, Array.from(set))),
  );

  for (const e of entryByUuid.values()) {
    e.hwiSoundAudio = ownerAudio.get(`HWI:${e.entryUuid}`) ?? null;
    for (const s of e.stems) {
      if (!s.anchorId) continue;
      if (!s.anchorKind || s.anchorKind === "UNKNOWN") continue;
      s.soundAudio = ownerAudio.get(`${s.anchorKind}:${s.anchorId}`) ?? null;
    }
  }

  // Choose entry title stem from meta.stems[]:
  // - Fully respect the capitalization of the headword (hwi.hw)
  // - Find the stem in meta.stems[] that matches the headword's exact capitalization
  // - If no exact match, fall back to case-insensitive match
  const selectedUnitStemId = u.stem_id;
  for (const e of entryByUuid.values()) {
    const headDisplay = mwDisplayTerm(e.hwiHw ?? e.headwordRaw ?? "");
    if (!headDisplay) {
      e.titleStem = e.stems[0] ? mwDisplayTerm(e.stems[0].stem) : null;
      continue;
    }

    // First priority: exact case-sensitive match with headword
    const exactMatch = e.stems.find((s) => mwDisplayTerm(s.stem) === headDisplay);
    if (exactMatch) {
      e.titleStem = mwDisplayTerm(exactMatch.stem);
      continue;
    }

    // Second priority: case-insensitive match, preferring stems that match headword's first-letter case
    const headLower = headDisplay.toLowerCase();
    const headFirstUpper = headDisplay[0] && headDisplay[0] >= "A" && headDisplay[0] <= "Z";
    const candidates = e.stems.filter((s) => mwDisplayTerm(s.stem).toLowerCase() === headLower);

    if (headFirstUpper) {
      // Headword starts uppercase: prefer uppercase-first stem
      const upper = candidates.find((s) => {
        const d = mwDisplayTerm(s.stem);
        return d[0] && d[0] >= "A" && d[0] <= "Z";
      });
      if (upper) {
        e.titleStem = mwDisplayTerm(upper.stem);
        continue;
      }
    } else {
      // Headword starts lowercase: prefer lowercase-first stem
      const lower = candidates.find((s) => {
        const d = mwDisplayTerm(s.stem);
        return d[0] && d[0] >= "a" && d[0] <= "z";
      });
      if (lower) {
        e.titleStem = mwDisplayTerm(lower.stem);
        continue;
      }
    }

    // Fallback: any case-insensitive match
    if (candidates[0]) {
      e.titleStem = mwDisplayTerm(candidates[0].stem);
      continue;
    }

    // Last resort: use headword display or first stem
    e.titleStem = headDisplay || (e.stems[0] ? mwDisplayTerm(e.stems[0].stem) : null);
  }

  // Definitions: normalized sense tree (mw_sense + mw_sense_dt)
  const [droAllRows, senseRows, dtRows] =
    entryUuids.length === 0
      ? [[], [], []]
      : await Promise.all([
          sql<Array<{ dro_id: string; entry_uuid: string; rank: number; drp: string }>>`
            SELECT dro_id, entry_uuid, rank, drp
            FROM mw_dro
            WHERE entry_uuid = ANY(${sql.array(entryUuids, 2950)})
            ORDER BY entry_uuid ASC, rank ASC
          `,
          sql<
            Array<{
              sense_id: string;
              entry_uuid: string;
              scope_type: "ENTRY" | "DRO";
              scope_id: string;
              vd: string | null;
              kind: string;
              sn: string | null;
              depth: number;
              rank: number;
            }>
          >`
            SELECT
              sense_id,
              entry_uuid,
              scope_type,
              scope_id,
              vd,
              kind,
              sn,
              depth,
              rank
            FROM mw_sense
            WHERE entry_uuid = ANY(${sql.array(entryUuids, 2950)})
            ORDER BY entry_uuid ASC, scope_type ASC, scope_id ASC, rank ASC
          `,
          sql<
            Array<{
              dt_id: string;
              sense_id: string;
              dt_type: string;
              rank: number;
              text: string | null;
              payload: any | null;
            }>
          >`
            SELECT
              d.dt_id as dt_id,
              d.sense_id as sense_id,
              d.dt_type as dt_type,
              d.rank as rank,
              d.text as text,
              d.payload as payload
            FROM mw_sense_dt d
            INNER JOIN mw_sense s ON s.sense_id = d.sense_id
            WHERE s.entry_uuid = ANY(${sql.array(entryUuids, 2950)})
            ORDER BY d.sense_id ASC, d.rank ASC
          `,
        ]);

  const droRankById = new Map<string, number>();
  const droDrpById = new Map<string, string>();
  for (const d of droAllRows as any[]) {
    droRankById.set(d.dro_id, d.rank);
    droDrpById.set(d.dro_id, d.drp);
  }

  const dtBySenseId = new Map<string, WordDetail["entries"][number]["definitions"]["scopes"][number]["senses"][number]["dt"]>();
  for (const d of dtRows as any[]) {
    const arr = dtBySenseId.get(d.sense_id) ?? [];
    arr.push({
      dtId: d.dt_id,
      dtType: d.dt_type,
      rank: d.rank,
      text: d.text,
      payload: d.payload,
    });
    dtBySenseId.set(d.sense_id, arr);
  }

  // scopeKey -> scope object (per entry)
  const scopeByEntry = new Map<string, Map<string, WordDetail["entries"][number]["definitions"]["scopes"][number]>>();
  for (const s of senseRows as any[]) {
    const entry = entryByUuid.get(s.entry_uuid);
    if (!entry) continue;

    const key = `${s.scope_type}:${s.scope_id}`;
    const entryMap = scopeByEntry.get(s.entry_uuid) ?? new Map();
    let scope = entryMap.get(key);
    if (!scope) {
      scope = {
        scopeType: s.scope_type,
        scopeId: s.scope_id,
        label: s.scope_type === "DRO" ? droDrpById.get(s.scope_id) ?? null : null,
        senses: [],
      };
      entryMap.set(key, scope);
      scopeByEntry.set(s.entry_uuid, entryMap);
    }

    scope.senses.push({
      senseId: s.sense_id,
      kind: s.kind,
      sn: s.sn,
      vd: s.vd,
      depth: s.depth,
      rank: s.rank,
      dt: dtBySenseId.get(s.sense_id) ?? [],
    });
  }

  for (const [entryUuid, scopesMap] of scopeByEntry.entries()) {
    const entry = entryByUuid.get(entryUuid);
    if (!entry) continue;
    const scopes = Array.from(scopesMap.values());
    // Stable, idiomatic ordering: ENTRY defs first, then DRO defs in dro rank order.
    scopes.sort((a, b) => {
      if (a.scopeType !== b.scopeType) return a.scopeType === "ENTRY" ? -1 : 1;
      if (a.scopeType === "DRO" && b.scopeType === "DRO") {
        const ra = droRankById.get(a.scopeId) ?? Number.MAX_SAFE_INTEGER;
        const rb = droRankById.get(b.scopeId) ?? Number.MAX_SAFE_INTEGER;
        if (ra !== rb) return ra - rb;
      }
      return a.scopeId.localeCompare(b.scopeId);
    });
    entry.definitions.scopes = scopes;
  }

  // Order: selected-stem entry first, then remaining by lexical_group_entry.rank
  const selectedEntryUuid = u.selected_stem_entry_uuid;
  const orderedEntries = Array.from(entryByUuid.values()).sort((a, b) => {
    const aSel = a.entryUuid === selectedEntryUuid ? 0 : 1;
    const bSel = b.entryUuid === selectedEntryUuid ? 0 : 1;
    if (aSel !== bSel) return aSel - bSel;
    return a.groupRank - b.groupRank;
  });

  return {
    unitId: u.unit_id,
    label: mwDisplayTerm(u.selected_stem) || u.label,
    anchorKind: u.anchor_kind ?? null,
    progress: u.progress,
    lastReviewedAt: u.last_reviewed_at,
    shortdef: shortdef || null,
    headwordRaw: u.headword_raw,
    metaId: u.meta_id,
    groupId: u.group_id,
    stemId: u.stem_id,
    selectedStem: {
      entryUuid: u.selected_stem_entry_uuid,
      rank: u.selected_stem_rank,
      stem: u.selected_stem,
      stemNorm: u.selected_stem_norm,
      anchorKind: u.selected_stem_anchor_kind,
      fallbackWarning: u.selected_stem_fallback_warning,
      soundAudio:
        u.selected_stem_anchor_id
          ? (ownerAudio.get(`${u.selected_stem_anchor_kind}:${u.selected_stem_anchor_id}`) ?? null)
          : null,
    },
    entries: orderedEntries,
  };
}

