import { and, eq } from "drizzle-orm";
import {
    lexicalGroup,
    learningUnit,
    mwDro,
    mwIn,
    mwAhw,
    mwEntry,
    mwHwi,
    mwPronunciation,
    mwStem,
    mwUro,
    mwVr,
    lexicalGroupEntry,
} from "@/lib/db/schema";
import type { SelectLearningUnit, SelectLexicalGroup } from "@/lib/db/schema";
import { GetUnitResult } from "@/lib/types/commons";
import { db } from "@/lib/db/client";
import { randomUUID } from "crypto";

function normKey(s: string): string {
    // Case-insensitive normalization (China === china).
    // Also strip MW formatting markers like '*' so `con*tex*tu*al` matches `contextual`.
    return s.replace(/\*/g, "").normalize("NFC").trim().toLowerCase();
}

function extractHwiPronunciations(entry: { entryUuid: string; rawJson: unknown; fetchedAt: Date }) {
    const e = entry.rawJson as any;
    const prs = e?.hwi?.prs;
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

        // Skip empty rows; we can expand later as we model more attributes.
        if (!mw && !soundAudio) continue;

        out.push({
            entryUuid: entry.entryUuid,
            ownerType: "HWI",
            ownerId: entry.entryUuid,
            mw,
            l,
            l2,
            pun,
            soundAudio,
            soundRef,
            soundStat,
            rank: i,
            fetchedAt: entry.fetchedAt ?? new Date(),
        });
    }

    return out;
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

function extractVariantsAndInflections(entry: { entryUuid: string; rawJson: unknown; fetchedAt: Date }) {
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

    for (const node of walkJson(entry.rawJson)) {
        const obj = node.value as any;

        if (Array.isArray(obj?.vrs)) {
            const scopeType = scopeFromPath(node.path);
            obj.vrs.forEach((vr: any, rank: number) => {
                const va = typeof vr?.va === "string" ? vr.va : null;
                if (!va || !va.trim()) return;
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
                const ifText = typeof inf?.if === "string" ? inf.if : null;
                const ifc = typeof inf?.ifc === "string" ? inf.ifc : null;
                const il = typeof inf?.il === "string" ? inf.il : null;
                if ((!ifText || !ifText.trim()) && (!ifc || !ifc.trim())) return;
                ins.push({
                    inId: randomUUID(),
                    entryUuid: entry.entryUuid,
                    inflection: ifText,
                    ifc,
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

export async function fetchLearningUnitFromLookupKey(key: string): Promise<SelectLearningUnit | null> {
    const rows = await db
        .select({ unit: learningUnit })
        .from(mwStem)
        .innerJoin(learningUnit, eq(learningUnit.stemId, mwStem.stemId))
        .where(eq(mwStem.stemNorm, key))
        .limit(1);

    return rows[0]?.unit ?? null;
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

/**
 * Upsert a lookup key. This is a separate UI boundary where we choose to silently upsert
 * when only a lookup key is required for update.
 */
export async function upsertLookupKey(_key: string, _unitId: string): Promise<void> {
    // Deprecated in the stem-anchored model; kept temporarily for call-site compatibility.
    return;
}

/**
 * Upsert a learning unit with its associated lexical group, entries, and lookup keys.
 */
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

            // 2b) hwi + ahws (best-effort)
            const hwiRows = result.entries
                .map((e) => {
                    const hw = (e.rawJson as any)?.hwi?.hw;
                    return typeof hw === "string" && hw.trim()
                        ? { entryUuid: e.entryUuid, hw: hw.trim() }
                        : null;
                })
                .filter((x): x is { entryUuid: string; hw: string } => !!x);
            if (hwiRows.length > 0) {
                await tx.insert(mwHwi).values(hwiRows).onConflictDoNothing();
            }

            const ahwRows = result.entries.flatMap((e) => {
                const ahws = (e.rawJson as any)?.ahws;
                if (!Array.isArray(ahws)) return [];
                return ahws
                    .map((a: any, rank: number) => ({
                        entryUuid: e.entryUuid,
                        hw: typeof a?.hw === "string" ? a.hw : "",
                        rank,
                    }))
                    .filter((a: any) => a.hw && a.hw.trim());
            });
            if (ahwRows.length > 0) {
                await tx.insert(mwAhw).values(ahwRows).onConflictDoNothing();
            }

            // 2c) dros + uros (top-level blocks, used for stem anchoring)
            const droRows = result.entries.flatMap((e) => {
                const dros = (e.rawJson as any)?.dros;
                if (!Array.isArray(dros)) return [];
                return dros
                    .map((d: any, rank: number) => ({
                        droId: randomUUID(),
                        entryUuid: e.entryUuid,
                        drp: typeof d?.drp === "string" ? d.drp : "",
                        rank,
                        def: d?.def ?? null,
                        fetchedAt: e.fetchedAt ?? new Date(),
                    }))
                    .filter((d: any) => d.drp && d.drp.trim() && d.def !== null);
            });
            if (droRows.length > 0) {
                await tx.insert(mwDro).values(droRows as any).onConflictDoNothing({
                    target: [mwDro.entryUuid, mwDro.rank],
                });
            }

            const uroRows = result.entries.flatMap((e) => {
                const uros = (e.rawJson as any)?.uros;
                if (!Array.isArray(uros)) return [];
                return uros
                    .map((u: any, rank: number) => ({
                        uroId: randomUUID(),
                        entryUuid: e.entryUuid,
                        ure: typeof u?.ure === "string" ? u.ure : "",
                        fl: typeof u?.fl === "string" ? u.fl : "",
                        rank,
                        utxt: u?.utxt ?? null,
                        rawJson: u ?? null,
                        fetchedAt: e.fetchedAt ?? new Date(),
                    }))
                    .filter((u: any) => u.ure && u.ure.trim() && u.fl && u.fl.trim());
            });
            if (uroRows.length > 0) {
                await tx.insert(mwUro).values(uroRows as any).onConflictDoNothing({
                    target: [mwUro.entryUuid, mwUro.rank],
                });
            }

            // 2d) variants + inflections (best-effort, used for stem anchoring)
            const vrRowsAll: any[] = [];
            const inRowsAll: any[] = [];
            for (const e of result.entries) {
                const fetchedAt = e.fetchedAt ?? new Date();
                const { vrs, ins } = extractVariantsAndInflections({
                    entryUuid: e.entryUuid,
                    rawJson: e.rawJson,
                    fetchedAt,
                });
                vrRowsAll.push(...vrs);
                inRowsAll.push(...ins);
            }
            if (vrRowsAll.length > 0) {
                await tx.insert(mwVr).values(vrRowsAll).onConflictDoNothing();
            }
            if (inRowsAll.length > 0) {
                await tx.insert(mwIn).values(inRowsAll).onConflictDoNothing();
            }

            // 3) group entries: PK(groupId, entryUuid)
            await tx
                .insert(lexicalGroupEntry)
                .values(result.groupEntries)
                .onConflictDoNothing(); // composite PK handles it

            // 3b) headword pronunciations (hwi.prs)
            const prRows = result.entries.flatMap((e) =>
                extractHwiPronunciations({
                    entryUuid: e.entryUuid,
                    rawJson: e.rawJson,
                    fetchedAt: e.fetchedAt ?? new Date(),
                }),
            );
            if (prRows.length > 0) {
                await tx
                    .insert(mwPronunciation)
                    .values(prRows)
                    .onConflictDoNothing({
                        target: [mwPronunciation.ownerType, mwPronunciation.ownerId, mwPronunciation.rank],
                    });
            }

            // 3c) mw_stem rows (meta.stems) for each entry
            const droByNorm = new Map<string, { kind: string; id: string }>();
            for (const d of droRows) droByNorm.set(normKey(d.drp), { kind: "DRO", id: d.droId });
            const uroByNorm = new Map<string, { kind: string; id: string }>();
            for (const u of uroRows) uroByNorm.set(normKey(u.ure), { kind: "URO", id: u.uroId });
            const vrByNorm = new Map<string, { kind: string; id: string }>();
            for (const v of vrRowsAll) vrByNorm.set(normKey(v.va), { kind: "VRS", id: v.vrId });
            const inByNorm = new Map<string, { kind: string; id: string }>();
            for (const i of inRowsAll) {
                if (i.inflection) inByNorm.set(normKey(i.inflection), { kind: "INS", id: i.inId });
                if (i.ifc) inByNorm.set(normKey(i.ifc), { kind: "INS", id: i.inId });
            }

            const stemRows = result.entries.flatMap((e) => {
                const stems = Array.isArray(e.stems) ? (e.stems as any[]) : [];
                const hwiHwNorm = normKey((e.rawJson as any)?.hwi?.hw ?? "");
                return stems
                    .filter((s) => typeof s === "string" && s.trim().length > 0)
                    .map((stem: string, rank: number) => {
                        const stemNorm = normKey(stem);
                        const isSelected =
                            e.entryUuid === result.unit.representativeEntryUuid &&
                            stemNorm === normKey(result.unit.createdFromLookupKey);

                        const anchor =
                            droByNorm.get(stemNorm) ??
                            uroByNorm.get(stemNorm) ??
                            vrByNorm.get(stemNorm) ??
                            inByNorm.get(stemNorm) ??
                            (hwiHwNorm === stemNorm ? { kind: "HWI", id: e.entryUuid } : undefined);

                        return {
                            stemId: isSelected ? result.unit.stemId : undefined,
                            entryUuid: e.entryUuid,
                            stem,
                            stemNorm,
                            anchorKind: anchor?.kind ?? "UNKNOWN",
                            anchorId: anchor?.id ?? null,
                            fallbackWarning: anchor ? false : true,
                            rank,
                            fetchedAt: e.fetchedAt ?? new Date(),
                        };
                    });
            });
            if (stemRows.length > 0) {
                // Insert all, letting DB generate stem_id except for the selected one (provided above).
                await tx.insert(mwStem).values(stemRows as any).onConflictDoNothing({
                    target: [mwStem.entryUuid, mwStem.rank],
                });
            }
        }

        // 4) learning unit: needs a uniqueness definition
        // If unitId is randomUUID, conflict won't happen unless you re-run same unitId.
        // Better: add UNIQUE(label, groupId) or UNIQUE(label, fingerprint) depending on schema design.
        await tx
            .insert(learningUnit)
            .values(result.unit)
            .onConflictDoNothing({ target: learningUnit.unitId }); // minimally safe
    });
}

