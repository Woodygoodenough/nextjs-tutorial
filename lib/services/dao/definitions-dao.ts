import { eq } from "drizzle-orm";

import { mwSense, mwSenseDt } from "@/lib/db/schema";
import { parseMwDefinitions } from "@/lib/services/dao/mw-def-parse";

/**
 * Rebuild normalized MW definition tables for a single entry from `mw_entry.raw_json`.
 *
 * - Deletes existing `mw_sense` (cascade deletes `mw_sense_dt`) for this entry.
 * - Inserts a fresh, ordered snapshot.
 *
 * We do this rebuild-style (instead of upserting deep trees) because:
 * - sense graphs are hierarchical and MW can reorder items between fetches
 * - we intentionally do not want to store raw JSON downstream
 */
export async function rebuildMwDefinitionsForEntry(
  tx: any,
  args: {
    entryUuid: string;
    rawJson: unknown;
    fetchedAt: Date;
    /**
     * Optional mapping from dros[] index → persisted mw_dro.dro_id for this entry.
     * If omitted, DRO scope ids will use a placeholder "dro:<rank>".
     */
    droIdByRank?: Map<number, string>;
  },
): Promise<{ senses: number; dt: number }> {
  await tx.delete(mwSense).where(eq(mwSense.entryUuid, args.entryUuid));

  const parsed = parseMwDefinitions({
    entryUuid: args.entryUuid,
    entryRawJson: args.rawJson,
    fetchedAt: args.fetchedAt,
    droIdByRank: args.droIdByRank,
  });

  if (parsed.senses.length > 0) {
    await tx.insert(mwSense).values(
      parsed.senses.map((s) => ({
        senseId: s.senseId,
        entryUuid: s.entryUuid,
        scopeType: s.scopeType,
        scopeId: s.scopeId,
        vd: s.vd,
        kind: s.kind,
        sn: s.sn,
        depth: s.depth,
        rank: s.rank,
        fetchedAt: s.fetchedAt,
      })),
    );
  }

  if (parsed.dts.length > 0) {
    await tx.insert(mwSenseDt).values(
      parsed.dts.map((d) => ({
        dtId: d.dtId,
        senseId: d.senseId,
        dtType: d.dtType,
        rank: d.rank,
        text: d.text,
        payload: d.payload as any,
        fetchedAt: d.fetchedAt,
      })),
    );
  }

  return { senses: parsed.senses.length, dt: parsed.dts.length };
}

