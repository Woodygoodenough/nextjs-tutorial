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
import { morphBaseCandidates } from "@/lib/services/dao/stem-morph";
import { extractPronunciationsFromPrs, extractVariantsAndInflections, normKey } from "@/lib/services/dao/mw-extract";
import { fetchLearningUnitsByStemNorm } from "@/lib/services/dao/learning-unit-summaries";

export async function fetchLearningUnitsFromLookupKey(key: string): Promise<Array<SelectLearningUnit>> {
    return await fetchLearningUnitsByStemNorm(key);
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
 * Upsert a learning unit with its associated lexical group, entries, and semantic tables.
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
        await tx
            .insert(mwEntry)
            .values(result.entries)
            .onConflictDoNothing({ target: mwEntry.entryUuid });

        // Resolve the stem_id we should attach the learning_unit to.
        // Important: mw_stem rows may already exist (e.g. group exists / prior runs), in which case
        // we must reuse the existing stem_id rather than a fresh random UUID.
        const repEntryUuid = result.unit.representativeEntryUuid;
        const repEntry = result.entries.find((e) => e.entryUuid === repEntryUuid);
        const repStems = Array.isArray((repEntry as any)?.stems) ? ((repEntry as any).stems as any[]) : [];
        const repStemNorms = repStems.filter((s) => typeof s === "string" && s.trim().length > 0).map((s) => normKey(s as string));
        const desiredStemNorm = normKey(result.unit.createdFromLookupKey);
        let selectedStemRank = repStemNorms.findIndex((n) => n === desiredStemNorm);
        if (selectedStemRank === -1) {
            // Fallback: if lookup key isn't present as a stem, attach to the first stem.
            selectedStemRank = repStemNorms.length > 0 ? 0 : -1;
        }
        if (selectedStemRank === -1) {
            throw new Error("Cannot create learning_unit: representative entry has no meta.stems[]");
        }

        const existingStem = await tx
            .select({ stemId: mwStem.stemId })
            .from(mwStem)
            .where(and(eq(mwStem.entryUuid, repEntryUuid), eq(mwStem.rank, selectedStemRank)))
            .limit(1);
        if (existingStem[0]?.stemId) {
            result.unit.stemId = existingStem[0].stemId;
        }

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
                    ahwId: randomUUID(),
                    entryUuid: e.entryUuid,
                    hw: typeof a?.hw === "string" ? a.hw : "",
                    rank,
                    _prs: a?.prs,
                }))
                .filter((a: any) => a.hw && a.hw.trim());
        });
        if (ahwRows.length > 0) {
            await tx
                .insert(mwAhw)
                .values(ahwRows.map(({ _prs, ...row }) => row) as any)
                .onConflictDoNothing();
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
                    _prs: u?.prs,
                }))
                .filter((u: any) => u.ure && u.ure.trim() && u.fl && u.fl.trim());
        });
        if (uroRows.length > 0) {
            await tx.insert(mwUro).values(uroRows.map(({ _prs, ...row }) => row) as any).onConflictDoNothing({
                target: [mwUro.entryUuid, mwUro.rank],
            });
        }

        // 2d) variants + inflections (best-effort, used for stem anchoring)
        const vrRowsAll: any[] = [];
        const inRowsAll: any[] = [];
        const extraPrRows: any[] = [];
        for (const e of result.entries) {
            const fetchedAt = e.fetchedAt ?? new Date();
            const { vrs, ins, prRows } = extractVariantsAndInflections({
                entryUuid: e.entryUuid,
                rawJson: e.rawJson,
                fetchedAt,
            });
            vrRowsAll.push(...vrs);
            inRowsAll.push(...ins);
            extraPrRows.push(...prRows);
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

        // 3b) pronunciations for supported owners (HWI, AHW, DRO, URO, VRS, INS)
        const prRows: any[] = [];
        for (const e of result.entries) {
            const fetchedAt = e.fetchedAt ?? new Date();
            const raw = e.rawJson as any;

            prRows.push(
                ...extractPronunciationsFromPrs({
                    entryUuid: e.entryUuid,
                    ownerType: "HWI",
                    ownerId: e.entryUuid,
                    prs: raw?.hwi?.prs,
                    fetchedAt,
                }),
            );
        }

        // AHW prs (if present)
        for (const a of ahwRows) {
            if (Array.isArray((a as any)._prs)) {
                prRows.push(
                    ...extractPronunciationsFromPrs({
                        entryUuid: a.entryUuid,
                        ownerType: "AHW",
                        ownerId: a.ahwId,
                        prs: (a as any)._prs,
                        fetchedAt: new Date(),
                    }),
                );
            }
        }

        // DRO prs (if present)
        for (const d of droRows as any[]) {
            const rawPrs = (d as any)._prs;
            if (Array.isArray(rawPrs)) {
                prRows.push(
                    ...extractPronunciationsFromPrs({
                        entryUuid: d.entryUuid,
                        ownerType: "DRO",
                        ownerId: d.droId,
                        prs: rawPrs,
                        fetchedAt: d.fetchedAt ?? new Date(),
                    }),
                );
            }
        }

        // URO prs (if present)
        for (const u of uroRows as any[]) {
            const rawPrs = (u as any)._prs;
            if (Array.isArray(rawPrs)) {
                prRows.push(
                    ...extractPronunciationsFromPrs({
                        entryUuid: u.entryUuid,
                        ownerType: "URO",
                        ownerId: u.uroId,
                        prs: rawPrs,
                        fetchedAt: u.fetchedAt ?? new Date(),
                    }),
                );
            }
        }

        // VRS/INS prs extracted during walk
        prRows.push(...extraPrRows);

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
        const ahwByNorm = new Map<string, { kind: string; id: string }>();
        for (const a of ahwRows) ahwByNorm.set(normKey(a.hw), { kind: "AHW", id: a.ahwId });

        const stemRows = result.entries.flatMap((e) => {
            const stems = Array.isArray(e.stems) ? (e.stems as any[]) : [];
            const hwiHwNorm = normKey((e.rawJson as any)?.hwi?.hw ?? "");
            const stemNormSet = new Set(
                stems.filter((s) => typeof s === "string" && s.trim().length > 0).map((s: string) => normKey(s)),
            );
            return stems
                .filter((s) => typeof s === "string" && s.trim().length > 0)
                .map((stem: string, rank: number) => {
                    const stemNorm = normKey(stem);
                    const isSelected = e.entryUuid === repEntryUuid && rank === selectedStemRank;

                    const resolve = (k: string) =>
                        droByNorm.get(k) ??
                        uroByNorm.get(k) ??
                        vrByNorm.get(k) ??
                        inByNorm.get(k) ??
                        ahwByNorm.get(k) ??
                        (hwiHwNorm === k ? { kind: "HWI", id: e.entryUuid } : undefined);

                    let anchor = resolve(stemNorm);
                    if (!anchor) {
                        for (const cand of morphBaseCandidates(stemNorm)) {
                            if (!stemNormSet.has(cand)) continue;
                            anchor = resolve(cand);
                            if (anchor) break;
                        }
                    }

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

        // 4) learning unit: needs a uniqueness definition
        // If unitId is randomUUID, conflict won't happen unless you re-run same unitId.
        // Better: add UNIQUE(label, groupId) or UNIQUE(label, fingerprint) depending on schema design.
        await tx
            .insert(learningUnit)
            .values(result.unit)
            .onConflictDoNothing({ target: learningUnit.unitId }); // minimally safe
    });
}

