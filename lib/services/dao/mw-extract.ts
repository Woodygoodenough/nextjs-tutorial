import { randomUUID } from "crypto";

export function normKey(s: string): string {
  // Case-insensitive normalization.
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

export function extractPronunciationsFromPrs(args: {
  entryUuid: string;
  ownerType: string;
  ownerId: string;
  prs: unknown;
  fetchedAt: Date;
}) {
  const prs = args.prs as any[];
  if (!Array.isArray(prs)) return [];

  const out: Array<{
    entryUuid: string;
    ownerType: string;
    ownerId: string;
    mw: string | null;
    l: string | null;
    l2: string | null;
    pun: string | null;
    soundAudio: string | null;
    soundRef: string | null;
    soundStat: string | null;
    rank: number;
    fetchedAt: Date;
  }> = [];

  for (let i = 0; i < prs.length; i++) {
    const p = prs[i] as any;
    const mw = typeof p?.mw === "string" ? p.mw : null;
    const l = typeof p?.l === "string" ? p.l : null;
    const l2 = typeof p?.l2 === "string" ? p.l2 : null;
    const pun = typeof p?.pun === "string" ? p.pun : null;
    const soundAudio = typeof p?.sound?.audio === "string" ? p.sound.audio : null;
    const soundRef = typeof p?.sound?.ref === "string" ? p.sound.ref : null;
    const soundStat = typeof p?.sound?.stat === "string" ? p.sound.stat : null;

    if (!mw && !soundAudio) continue;

    out.push({
      entryUuid: args.entryUuid,
      ownerType: args.ownerType,
      ownerId: args.ownerId,
      mw,
      l,
      l2,
      pun,
      soundAudio,
      soundRef,
      soundStat,
      rank: i,
      fetchedAt: args.fetchedAt ?? new Date(),
    });
  }

  return out;
}

export function extractVariantsAndInflections(entry: { entryUuid: string; rawJson: unknown; fetchedAt: Date }) {
  const vrs: Array<{
    vrId: string;
    entryUuid: string;
    va: string;
    vl: string | null;
    rank: number;
    scopeType: string;
    scopeRef: string;
    fetchedAt: Date;
  }> = [];
  const ins: Array<{
    inId: string;
    entryUuid: string;
    inflection: string | null;
    ifc: string | null;
    il: string | null;
    rank: number;
    scopeType: string;
    scopeRef: string;
    fetchedAt: Date;
  }> = [];
  const prRows: Array<{
    entryUuid: string;
    ownerType: string;
    ownerId: string;
    mw: string | null;
    l: string | null;
    l2: string | null;
    pun: string | null;
    soundAudio: string | null;
    soundRef: string | null;
    soundStat: string | null;
    rank: number;
    fetchedAt: Date;
  }> = [];

  for (const node of walkJson(entry.rawJson)) {
    const obj = node.value as any;

    if (Array.isArray(obj?.vrs)) {
      const scopeType = scopeFromPath(node.path);
      obj.vrs.forEach((vr: any, rank: number) => {
        const va = typeof vr?.va === "string" ? vr.va : null;
        if (!va || !va.trim()) return;
        const vrId = randomUUID();
        vrs.push({
          vrId,
          entryUuid: entry.entryUuid,
          va,
          vl: typeof vr?.vl === "string" ? vr.vl : null,
          rank,
          scopeType,
          scopeRef: node.path,
          fetchedAt: entry.fetchedAt,
        });

        const prs = vr?.prs;
        if (Array.isArray(prs)) {
          prRows.push(
            ...extractPronunciationsFromPrs({
              entryUuid: entry.entryUuid,
              ownerType: "VRS",
              ownerId: vrId,
              prs,
              fetchedAt: entry.fetchedAt,
            }),
          );
        }
      });
    }

    if (Array.isArray(obj?.ins)) {
      const scopeType = scopeFromPath(node.path);
      obj.ins.forEach((inf: any, rank: number) => {
        const ifText = typeof inf?.if === "string" ? inf.if : null;
        const ifc = typeof inf?.ifc === "string" ? inf.ifc : null;
        const il = typeof inf?.il === "string" ? inf.il : null;
        if ((!ifText || !ifText.trim()) && (!ifc || !ifc.trim())) return;
        const inId = randomUUID();
        ins.push({
          inId,
          entryUuid: entry.entryUuid,
          inflection: ifText,
          ifc,
          il,
          rank,
          scopeType,
          scopeRef: node.path,
          fetchedAt: entry.fetchedAt,
        });

        const prs = inf?.prs;
        if (Array.isArray(prs)) {
          prRows.push(
            ...extractPronunciationsFromPrs({
              entryUuid: entry.entryUuid,
              ownerType: "INS",
              ownerId: inId,
              prs,
              fetchedAt: entry.fetchedAt,
            }),
          );
        }
      });
    }
  }

  return { vrs, ins, prRows };
}

