import { randomUUID } from "crypto";

/**
 * Best-effort token normalization for MW "running text" strings.
 *
 * We intentionally do NOT store raw JSON def trees downstream. Instead we store
 * a replayable, normalized form of dt text/extras.
 *
 * This function converts common MW token patterns into plain text, keeping
 * as much meaning as possible without attempting full HTML rendering.
 *
 * Reference: Merriam-Webster JSON documentation (sense structure + tokens).
 * `https://dictionaryapi.com/products/json#sec-2.sense-struct`
 */
export function mwTextToPlain(input: string): string {
  let s = input ?? "";

  // Common punctuation/format tokens (keep content, drop markup).
  s = s.replace(/\{bc\}/g, ": ");
  s = s.replace(/\{p_br\}/g, "\n");
  s = s.replace(/\{ldquo\}/g, "“").replace(/\{rdquo\}/g, "”");

  // Simple paired formatting tokens: {it}...{/it}, {b}...{/b}, etc.
  // Keep the inner text.
  s = s.replace(/\{\/?(it|b|sc|sup|inf|bit|itsc|rom)\}/g, "");

  // Cross-ref group wrappers: keep inner text, drop wrapper tokens.
  s = s.replace(/\{\/?(dx|dx_def|dx_ety|ma)\}/g, "");

  // Word-marking tokens: keep inner content, drop wrapper.
  s = s.replace(/\{\/?(wi|phrase|qword|parahw|gloss)\}/g, "");

  // Cross-reference tokens where field 2 is visible link text.
  // {a_link|text} ; {d_link|text|id} ; {i_link|text|id} ; {et_link|text|id}
  s = s.replace(/\{(a_link|d_link|i_link|et_link|mat)\|([^|}]*)[^}]*\}/g, "$2");

  // Synonymous cross-ref token: {sx|text||...} => text
  s = s.replace(/\{sx\|([^|}]*)[^}]*\}/g, "$1");

  // Directional cross-ref target token: {dxt|text|id|...} => text
  s = s.replace(/\{dxt\|([^|}]*)[^}]*\}/g, "$1");

  // Any remaining "{...}" tokens: drop them (last resort).
  s = s.replace(/\{[^}]+\}/g, "");

  // Normalize whitespace.
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/[ \t]{2,}/g, " ");
  return s.trim();
}

export type ParsedSenseNode = {
  senseId: string;
  entryUuid: string;
  scopeType: "ENTRY" | "DRO";
  scopeId: string;
  vd: string | null;
  kind: "sense" | "sen" | "bs" | "pseq";
  sn: string | null;
  depth: number;
  rank: number;
  fetchedAt: Date;
};

export type ParsedSenseDt = {
  dtId: string;
  senseId: string;
  dtType: string;
  rank: number;
  text: string | null;
  payload: unknown | null;
  fetchedAt: Date;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function normalizeSn(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function parseDtArray(args: {
  senseId: string;
  dt: unknown;
  fetchedAt: Date;
}): ParsedSenseDt[] {
  const out: ParsedSenseDt[] = [];
  const dt = args.dt;
  if (!Array.isArray(dt)) return out;

  let rank = 0;
  for (const item of dt as any[]) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const dtType = typeof item[0] === "string" ? (item[0] as string) : "unknown";
    const payload = item[1];

    if (dtType === "text" && typeof payload === "string") {
      out.push({
        dtId: randomUUID(),
        senseId: args.senseId,
        dtType,
        rank: rank++,
        text: mwTextToPlain(payload),
        payload: null,
        fetchedAt: args.fetchedAt,
      });
      continue;
    }

    if (dtType === "vis" && Array.isArray(payload)) {
      // Normalize example texts.
      const examples = (payload as any[])
        .map((v) => {
          const t = typeof v?.t === "string" ? mwTextToPlain(v.t) : null;
          if (!t) return null;
          const aq = v?.aq;
          return {
            t,
            aq: isObject(aq)
              ? {
                  auth: typeof aq.auth === "string" ? aq.auth : null,
                  source: typeof aq.source === "string" ? mwTextToPlain(aq.source) : null,
                  aqdate: typeof aq.aqdate === "string" ? aq.aqdate : null,
                }
              : null,
          };
        })
        .filter(Boolean);

      out.push({
        dtId: randomUUID(),
        senseId: args.senseId,
        dtType,
        rank: rank++,
        text: null,
        payload: { examples },
        fetchedAt: args.fetchedAt,
      });
      continue;
    }

    if (dtType === "ca" && isObject(payload)) {
      const intro = typeof payload.intro === "string" ? mwTextToPlain(payload.intro) : null;
      const cats = Array.isArray(payload.cats)
        ? (payload.cats as any[])
            .map((c) => ({
              cat: typeof c?.cat === "string" ? mwTextToPlain(c.cat) : null,
              catref: typeof c?.catref === "string" ? c.catref : null,
              pn: typeof c?.pn === "string" ? c.pn : null,
            }))
            .filter((c) => !!c.cat)
        : [];
      out.push({
        dtId: randomUUID(),
        senseId: args.senseId,
        dtType,
        rank: rank++,
        text: null,
        payload: { intro, cats },
        fetchedAt: args.fetchedAt,
      });
      continue;
    }

    if (dtType === "uns" && Array.isArray(payload)) {
      // Usage notes are nested arrays of dt-like items.
      // We keep a simplified replay payload (plain text + examples where possible).
      const items: Array<{ kind: string; text?: string; examples?: Array<{ t: string }> }> = [];
      for (const block of payload as any[]) {
        if (!Array.isArray(block)) continue;
        for (const sub of block as any[]) {
          if (!Array.isArray(sub) || sub.length < 2) continue;
          const k = typeof sub[0] === "string" ? sub[0] : "unknown";
          const v = sub[1];
          if (k === "text" && typeof v === "string") {
            items.push({ kind: "text", text: mwTextToPlain(v) });
          } else if (k === "vis" && Array.isArray(v)) {
            const examples = (v as any[])
              .map((ex) => (typeof ex?.t === "string" ? { t: mwTextToPlain(ex.t) } : null))
              .filter(Boolean) as Array<{ t: string }>;
            items.push({ kind: "vis", examples });
          } else {
            items.push({ kind: k });
          }
        }
      }
      out.push({
        dtId: randomUUID(),
        senseId: args.senseId,
        dtType,
        rank: rank++,
        text: null,
        payload: { items },
        fetchedAt: args.fetchedAt,
      });
      continue;
    }

    // Unknown dt item: store a minimal payload so it can be inspected later,
    // but avoid copying large nested objects.
    out.push({
      dtId: randomUUID(),
      senseId: args.senseId,
      dtType,
      rank: rank++,
      text: typeof payload === "string" ? mwTextToPlain(payload) : null,
      payload: null,
      fetchedAt: args.fetchedAt,
    });
  }

  return out;
}

/**
 * Parse MW definition structure (entry.def, dro.def) into a flattened, ordered
 * hierarchy of sense nodes + dt items.
 *
 * Supported (minimal) structures for now:
 * - def[].vd
 * - def[].sseq (sense sequence)
 * - sseq elements: "sense", "sen", "bs", "pseq"
 * - sense.dt (dt items: text, vis, ca, uns; others best-effort)
 */
export function parseMwDefinitions(args: {
  entryUuid: string;
  entryRawJson: unknown;
  fetchedAt: Date;
  droIdByRank?: Map<number, string>;
}): { senses: ParsedSenseNode[]; dts: ParsedSenseDt[] } {
  const senses: ParsedSenseNode[] = [];
  const dts: ParsedSenseDt[] = [];

  const rankByScope = new Map<string, number>();

  const nextRank = (scopeType: ParsedSenseNode["scopeType"], scopeId: string) => {
    const k = `${scopeType}:${scopeId}`;
    const cur = rankByScope.get(k) ?? 0;
    rankByScope.set(k, cur + 1);
    return cur;
  };

  const pushSense = (n: Omit<ParsedSenseNode, "rank">): ParsedSenseNode => {
    const node: ParsedSenseNode = { ...n, rank: nextRank(n.scopeType, n.scopeId) };
    senses.push(node);
    return node;
  };

  const walkSseq = (args2: {
    scopeType: "ENTRY" | "DRO";
    scopeId: string;
    vd: string | null;
    sseq: unknown;
    depth: number;
  }) => {
    const sseq = args2.sseq;
    if (!Array.isArray(sseq)) return;

    // sseq is array-of-sense-bundles; each bundle is an array of items like ["sense", {...}] or ["pseq", [...]]
    for (const bundle of sseq as any[]) {
      if (!Array.isArray(bundle)) continue;
      for (const el of bundle as any[]) {
        if (!Array.isArray(el) || el.length < 2) continue;
        const tag = el[0];
        const payload = el[1];
        if (typeof tag !== "string") continue;

        if (tag === "sense" && isObject(payload)) {
          const node = pushSense({
            senseId: randomUUID(),
            entryUuid: args.entryUuid,
            scopeType: args2.scopeType,
            scopeId: args2.scopeId,
            vd: args2.vd,
            kind: "sense",
            sn: normalizeSn(payload.sn),
            depth: args2.depth,
            fetchedAt: args.fetchedAt,
          });
          dts.push(...parseDtArray({ senseId: node.senseId, dt: payload.dt, fetchedAt: args.fetchedAt }));
          continue;
        }

        if (tag === "sen" && isObject(payload)) {
          const node = pushSense({
            senseId: randomUUID(),
            entryUuid: args.entryUuid,
            scopeType: args2.scopeType,
            scopeId: args2.scopeId,
            vd: args2.vd,
            kind: "sen",
            sn: normalizeSn(payload.sn),
            depth: args2.depth,
            fetchedAt: args.fetchedAt,
          });
          dts.push(...parseDtArray({ senseId: node.senseId, dt: (payload as any).dt, fetchedAt: args.fetchedAt }));
          continue;
        }

        if (tag === "bs" && isObject(payload) && isObject((payload as any).sense)) {
          const s = (payload as any).sense as any;
          const node = pushSense({
            senseId: randomUUID(),
            entryUuid: args.entryUuid,
            scopeType: args2.scopeType,
            scopeId: args2.scopeId,
            vd: args2.vd,
            kind: "bs",
            sn: normalizeSn(s.sn),
            depth: args2.depth,
            fetchedAt: args.fetchedAt,
          });
          dts.push(...parseDtArray({ senseId: node.senseId, dt: s.dt, fetchedAt: args.fetchedAt }));
          continue;
        }

        if (tag === "pseq" && Array.isArray(payload)) {
          // pseq is a sequence of sense-like elements, often with parenthesized sn.
          // We model pseq as a container node (for debug/structure), then walk its children.
          const node = pushSense({
            senseId: randomUUID(),
            entryUuid: args.entryUuid,
            scopeType: args2.scopeType,
            scopeId: args2.scopeId,
            vd: args2.vd,
            kind: "pseq",
            sn: null,
            depth: args2.depth,
            fetchedAt: args.fetchedAt,
          });
          // Walk the pseq contents as if it were an sseq "bundle".
          walkSseq({
            scopeType: args2.scopeType,
            scopeId: args2.scopeId,
            vd: args2.vd,
            sseq: [payload],
            depth: args2.depth + 1,
          });
          // Keep a breadcrumb dt item for the container to help debugging/replay.
          dts.push({
            dtId: randomUUID(),
            senseId: node.senseId,
            dtType: "pseq",
            rank: 0,
            text: null,
            payload: null,
            fetchedAt: args.fetchedAt,
          });
          continue;
        }
      }
    }
  };

  const raw = args.entryRawJson as any;

  // 1) Entry-level def
  const def = raw?.def;
  if (Array.isArray(def)) {
    for (const d of def as any[]) {
      const vd = typeof d?.vd === "string" ? d.vd : null;
      if (Array.isArray(d?.sseq)) {
        walkSseq({
          scopeType: "ENTRY",
          scopeId: args.entryUuid,
          vd,
          sseq: d.sseq,
          depth: 0,
        });
      }
    }
  }

  // 2) DRO-level defs: raw.dros[].def
  const dros = raw?.dros;
  if (Array.isArray(dros)) {
    dros.forEach((dro: any, droRank: number) => {
      const droId = args.droIdByRank?.get(droRank) ?? `dro:${droRank}`;
      // NOTE: we don't have MW dro_id in raw_json; our persisted mw_dro table uses (entry_uuid, rank)
      // and assigns a UUID. Downstream DAO will map this droRank to the real dro_id when inserting.
      const def2 = dro?.def;
      if (!Array.isArray(def2)) return;
      for (const d of def2 as any[]) {
        const vd = typeof d?.vd === "string" ? d.vd : null;
        if (Array.isArray(d?.sseq)) {
          walkSseq({
            scopeType: "DRO",
            scopeId: droId,
            vd,
            sseq: d.sseq,
            depth: 0,
          });
        }
      }
    });
  }

  return { senses, dts };
}

