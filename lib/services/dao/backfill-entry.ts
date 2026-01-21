import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

import { db } from "@/lib/db/client";
import {
  lexicalGroupEntry,
  learningUnit,
  mwAhw,
  mwDro,
  mwEntry,
  mwHwi,
  mwIn,
  mwPronunciation,
  mwStem,
  mwUro,
  mwVr,
} from "@/lib/db/schema";

function normKey(s: string): string {
  // Strip MW formatting markers like '*' so `con*tex*tu*al` matches `contextual`.
  return s.replace(/\*/g, "").normalize("NFC").trim().toLowerCase();
}

function scopeFromPath(path: string): string {
  if (path.includes(".dros[")) return "DRO";
  if (path.includes(".uros[")) return "URO";
  return "ENTRY";
}

function* walkJson(value: unknown, path: string = "$"): Generator<{ path: string; value: any }> {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      yield* walkJson(value[i], `${path}[${i}]`);
    }
    return;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    yield { path, value: obj };
    for (const [k, v] of Object.entries(obj)) {
      yield* walkJson(v, `${path}.${k}`);
    }
  }
}

type EntrySnapshot = {
  entryUuid: string;
  rawJson: unknown;
  stems: string[];
  fetchedAt: Date;
};

function extractEntrySnapshot(row: { entryUuid: string; rawJson: unknown; stems: unknown; fetchedAt: Date }): EntrySnapshot {
  const stems = Array.isArray(row.stems) ? (row.stems as any[]).filter((s) => typeof s === "string") : [];
  return {
    entryUuid: row.entryUuid,
    rawJson: row.rawJson,
    stems: stems as string[],
    fetchedAt: row.fetchedAt ?? new Date(),
  };
}

function extractHwi(entry: EntrySnapshot) {
  const hw = (entry.rawJson as any)?.hwi?.hw;
  if (typeof hw !== "string" || !hw.trim()) return null;
  return { entryUuid: entry.entryUuid, hw: hw.trim() };
}

function extractAhws(entry: EntrySnapshot) {
  const ahws = (entry.rawJson as any)?.ahws;
  if (!Array.isArray(ahws)) return [];
  return ahws
    .map((a: any, rank: number) => ({
      entryUuid: entry.entryUuid,
      hw: typeof a?.hw === "string" ? a.hw.trim() : "",
      rank,
    }))
    .filter((a: any) => a.hw);
}

function extractDros(entry: EntrySnapshot) {
  const dros = (entry.rawJson as any)?.dros;
  if (!Array.isArray(dros)) return [];
  return dros
    .map((d: any, rank: number) => ({
      droId: randomUUID(),
      entryUuid: entry.entryUuid,
      drp: typeof d?.drp === "string" ? d.drp.trim() : "",
      rank,
      def: d?.def ?? null,
      fetchedAt: entry.fetchedAt,
      _raw: d,
    }))
    .filter((d: any) => d.drp && d.def !== null);
}

function extractUros(entry: EntrySnapshot) {
  const uros = (entry.rawJson as any)?.uros;
  if (!Array.isArray(uros)) return [];
  return uros
    .map((u: any, rank: number) => ({
      uroId: randomUUID(),
      entryUuid: entry.entryUuid,
      ure: typeof u?.ure === "string" ? u.ure.trim() : "",
      fl: typeof u?.fl === "string" ? u.fl.trim() : "",
      rank,
      utxt: u?.utxt ?? null,
      rawJson: u ?? null,
      fetchedAt: entry.fetchedAt,
      _raw: u,
    }))
    .filter((u: any) => u.ure && u.fl);
}

function extractVariantsAndInflections(entry: EntrySnapshot) {
  const vrs: any[] = [];
  const ins: any[] = [];

  for (const node of walkJson(entry.rawJson)) {
    const obj = node.value as any;

    if (Array.isArray(obj?.vrs)) {
      const scopeType = scopeFromPath(node.path);
      obj.vrs.forEach((vr: any, rank: number) => {
        const va = typeof vr?.va === "string" ? vr.va.trim() : "";
        if (!va) return;
        vrs.push({
          vrId: randomUUID(),
          entryUuid: entry.entryUuid,
          va,
          vl: typeof vr?.vl === "string" ? vr.vl : null,
          rank,
          scopeType,
          scopeRef: node.path,
          fetchedAt: entry.fetchedAt,
        });
      });
    }

    if (Array.isArray(obj?.ins)) {
      const scopeType = scopeFromPath(node.path);
      obj.ins.forEach((inf: any, rank: number) => {
        const ifText = typeof inf?.if === "string" ? inf.if.trim() : "";
        const ifc = typeof inf?.ifc === "string" ? inf.ifc.trim() : "";
        const il = typeof inf?.il === "string" ? inf.il : null;
        if (!ifText && !ifc) return;
        ins.push({
          inId: randomUUID(),
          entryUuid: entry.entryUuid,
          inflection: ifText || null,
          ifc: ifc || null,
          il,
          rank,
          scopeType,
          scopeRef: node.path,
          fetchedAt: entry.fetchedAt,
        });
      });
    }
  }

  return { vrs, ins };
}

function extractPronunciations(
  entry: EntrySnapshot,
  droByRank: Map<number, string>,
  uroByRank: Map<number, string>,
) {
  const out: Array<{
    entryUuid: string;
    ownerType: string;
    ownerId: string;
    mw: string | null;
    pun: string | null;
    l: string | null;
    l2: string | null;
    soundAudio: string | null;
    soundRef: string | null;
    soundStat: string | null;
    rank: number;
    fetchedAt: Date;
  }> = [];

  const raw = entry.rawJson as any;

  const hwiPrs = raw?.hwi?.prs;
  if (Array.isArray(hwiPrs)) {
    hwiPrs.forEach((p: any, rank: number) => {
      const mw = typeof p?.mw === "string" ? p.mw : null;
      const soundAudio = typeof p?.sound?.audio === "string" ? p.sound.audio : null;
      if (!mw && !soundAudio) return;
      out.push({
        entryUuid: entry.entryUuid,
        ownerType: "HWI",
        ownerId: entry.entryUuid,
        mw,
        pun: typeof p?.pun === "string" ? p.pun : null,
        l: typeof p?.l === "string" ? p.l : null,
        l2: typeof p?.l2 === "string" ? p.l2 : null,
        soundAudio,
        soundRef: typeof p?.sound?.ref === "string" ? p.sound.ref : null,
        soundStat: typeof p?.sound?.stat === "string" ? p.sound.stat : null,
        rank,
        fetchedAt: entry.fetchedAt,
      });
    });
  }

  const dros = raw?.dros;
  if (Array.isArray(dros)) {
    dros.forEach((d: any, droRank: number) => {
      const ownerId = droByRank.get(droRank);
      if (!ownerId) return;
      const prs = d?.prs;
      if (!Array.isArray(prs)) return;
      prs.forEach((p: any, rank: number) => {
        const mw = typeof p?.mw === "string" ? p.mw : null;
        const soundAudio = typeof p?.sound?.audio === "string" ? p.sound.audio : null;
        if (!mw && !soundAudio) return;
        out.push({
          entryUuid: entry.entryUuid,
          ownerType: "DRO",
          ownerId,
          mw,
          pun: typeof p?.pun === "string" ? p.pun : null,
          l: typeof p?.l === "string" ? p.l : null,
          l2: typeof p?.l2 === "string" ? p.l2 : null,
          soundAudio,
          soundRef: typeof p?.sound?.ref === "string" ? p.sound.ref : null,
          soundStat: typeof p?.sound?.stat === "string" ? p.sound.stat : null,
          rank,
          fetchedAt: entry.fetchedAt,
        });
      });
    });
  }

  const uros = raw?.uros;
  if (Array.isArray(uros)) {
    uros.forEach((u: any, uroRank: number) => {
      const ownerId = uroByRank.get(uroRank);
      if (!ownerId) return;
      const prs = u?.prs;
      if (!Array.isArray(prs)) return;
      prs.forEach((p: any, rank: number) => {
        const mw = typeof p?.mw === "string" ? p.mw : null;
        const soundAudio = typeof p?.sound?.audio === "string" ? p.sound.audio : null;
        if (!mw && !soundAudio) return;
        out.push({
          entryUuid: entry.entryUuid,
          ownerType: "URO",
          ownerId,
          mw,
          pun: typeof p?.pun === "string" ? p.pun : null,
          l: typeof p?.l === "string" ? p.l : null,
          l2: typeof p?.l2 === "string" ? p.l2 : null,
          soundAudio,
          soundRef: typeof p?.sound?.ref === "string" ? p.sound.ref : null,
          soundStat: typeof p?.sound?.stat === "string" ? p.sound.stat : null,
          rank,
          fetchedAt: entry.fetchedAt,
        });
      });
    });
  }

  return out;
}

function resolveStemAnchors(entry: EntrySnapshot, droRows: any[], uroRows: any[], vrRows: any[], inRows: any[], ahwRows: any[]) {
  const droByNorm = new Map<string, { kind: string; id: string }>();
  for (const d of droRows) droByNorm.set(normKey(d.drp), { kind: "DRO", id: d.droId });
  const uroByNorm = new Map<string, { kind: string; id: string }>();
  for (const u of uroRows) uroByNorm.set(normKey(u.ure), { kind: "URO", id: u.uroId });
  const vrByNorm = new Map<string, { kind: string; id: string }>();
  for (const v of vrRows) vrByNorm.set(normKey(v.va), { kind: "VRS", id: v.vrId });
  const inByNorm = new Map<string, { kind: string; id: string }>();
  for (const i of inRows) {
    if (i.inflection) inByNorm.set(normKey(i.inflection), { kind: "INS", id: i.inId });
    if (i.ifc) inByNorm.set(normKey(i.ifc), { kind: "INS", id: i.inId });
  }
  const ahwByNorm = new Map<string, { kind: string; id: string }>();
  for (const a of ahwRows) ahwByNorm.set(normKey(a.hw), { kind: "AHW", id: a.ahwId });

  const hwiHwNorm = normKey((entry.rawJson as any)?.hwi?.hw ?? "");

  return (stemNorm: string) =>
    droByNorm.get(stemNorm) ??
    uroByNorm.get(stemNorm) ??
    vrByNorm.get(stemNorm) ??
    inByNorm.get(stemNorm) ??
    ahwByNorm.get(stemNorm) ??
    (hwiHwNorm === stemNorm ? { kind: "HWI", id: entry.entryUuid } : undefined);
}

export async function backfillEntrySemantics(entryUuid: string): Promise<void> {
  const rows = await db
    .select({
      entryUuid: mwEntry.entryUuid,
      rawJson: mwEntry.rawJson,
      stems: mwEntry.stems,
      fetchedAt: mwEntry.fetchedAt,
    })
    .from(mwEntry)
    .where(eq(mwEntry.entryUuid, entryUuid))
    .limit(1);

  const row = rows[0];
  if (!row) return;
  const entry = extractEntrySnapshot(row);

  await db.transaction(async (tx) => {
    const hwi = extractHwi(entry);
    if (hwi) {
      await tx.insert(mwHwi).values(hwi).onConflictDoUpdate({
        target: mwHwi.entryUuid,
        set: { hw: hwi.hw },
      });
    }

    // Replace AHW/VRS/INS for this entry (no FKs from other tables)
    await tx.delete(mwAhw).where(eq(mwAhw.entryUuid, entry.entryUuid));
    const ahws = extractAhws(entry);
    if (ahws.length) await tx.insert(mwAhw).values(ahws).onConflictDoNothing();

    await tx.delete(mwVr).where(eq(mwVr.entryUuid, entry.entryUuid));
    await tx.delete(mwIn).where(eq(mwIn.entryUuid, entry.entryUuid));
    const { vrs, ins } = extractVariantsAndInflections(entry);
    if (vrs.length) await tx.insert(mwVr).values(vrs).onConflictDoNothing();
    if (ins.length) await tx.insert(mwIn).values(ins).onConflictDoNothing();

    // Rebuild DRO/URO for this entry (safe; mw_pronunciation references are text)
    await tx.delete(mwDro).where(eq(mwDro.entryUuid, entry.entryUuid));
    await tx.delete(mwUro).where(eq(mwUro.entryUuid, entry.entryUuid));
    const dros = extractDros(entry);
    const uros = extractUros(entry);
    if (dros.length) await tx.insert(mwDro).values(dros).onConflictDoNothing();
    if (uros.length) await tx.insert(mwUro).values(uros).onConflictDoNothing();

    const droByRank = new Map<number, string>();
    for (const d of dros) droByRank.set(d.rank, d.droId);
    const uroByRank = new Map<number, string>();
    for (const u of uros) uroByRank.set(u.rank, u.uroId);

    // Rebuild pronunciations for this entry
    await tx.delete(mwPronunciation).where(eq(mwPronunciation.entryUuid, entry.entryUuid));
    const prs = extractPronunciations(entry, droByRank, uroByRank);
    if (prs.length) await tx.insert(mwPronunciation).values(prs).onConflictDoNothing();

    // Upsert stems (preserve stem_id so learning_unit FK stays valid)
    const resolveAnchor = resolveStemAnchors(entry, dros, uros, vrs, ins, ahws);
    const stemRows = entry.stems
      .filter((s) => typeof s === "string" && s.trim().length > 0)
      .map((stem, rank) => {
        const stemNorm = normKey(stem);
        const anchor = resolveAnchor(stemNorm);
        return {
          entryUuid: entry.entryUuid,
          stem,
          stemNorm,
          anchorKind: anchor?.kind ?? "UNKNOWN",
          anchorId: anchor?.id ?? null,
          fallbackWarning: anchor ? false : true,
          rank,
          fetchedAt: entry.fetchedAt,
        };
      });

    for (const s of stemRows) {
      await tx.insert(mwStem).values(s).onConflictDoUpdate({
        target: [mwStem.entryUuid, mwStem.rank],
        set: {
          stem: s.stem,
          stemNorm: s.stemNorm,
          anchorKind: s.anchorKind,
          anchorId: s.anchorId,
          fallbackWarning: s.fallbackWarning,
          fetchedAt: s.fetchedAt,
        },
      });
    }
  });
}

export async function backfillSemanticsForLearningUnits(): Promise<{ entries: number }> {
  // Only entries actually referenced by learning units.
  const luRows = await db
    .selectDistinct({ entryUuid: learningUnit.representativeEntryUuid })
    .from(learningUnit);

  const entryUuids = luRows.map((r) => r.entryUuid).filter(Boolean) as string[];
  const unique = Array.from(new Set(entryUuids));

  // Preload: only process entries that exist.
  const existing = await db
    .select({ entryUuid: mwEntry.entryUuid })
    .from(mwEntry)
    .where(inArray(mwEntry.entryUuid, unique));
  const existingSet = new Set(existing.map((e) => e.entryUuid));

  for (const id of unique) {
    if (!existingSet.has(id)) continue;
    await backfillEntrySemantics(id);
  }

  return { entries: existingSet.size };
}

