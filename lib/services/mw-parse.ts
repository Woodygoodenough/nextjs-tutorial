import type { InsertMwEntry } from "@/lib/db/schema";
import type { MWRawResponse } from "@/lib/services/mw-client";

function cleanHeadwordRaw(headwordRaw: string): string {
  return headwordRaw.replace(/\*/g, "");
}

function stemsFromRawEntry(raw: unknown): string[] {
  const meta = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>).meta : undefined;
  if (!meta || typeof meta !== "object") return [];
  const stems = (meta as Record<string, unknown>).stems;
  return Array.isArray(stems) ? stems.filter((x): x is string => typeof x === "string") : [];
}

function headwordRawFromEntry(raw: unknown): string {
  const hwi = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>).hwi : undefined;
  if (!hwi || typeof hwi !== "object") return "";
  const hw = (hwi as Record<string, unknown>).hw;
  return typeof hw === "string" ? hw : "";
}

/**
 * Parse MW "entries" raw array into rows ready for persistence.
 *
 * This intentionally keeps the *entire* entry object on `rawJson` so later backfills
 * can be derived from persisted data without re-calling MW.
 */
export function parseEntries(raw: MWRawResponse): Array<InsertMwEntry> {
  if (!Array.isArray(raw)) return [];

  return (raw as Array<unknown>)
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((e: Record<string, unknown>) => {
      const meta = typeof e.meta === "object" && e.meta !== null ? (e.meta as Record<string, unknown>) : null;
      const metaUuid = meta && typeof meta.uuid === "string" ? meta.uuid : null;
      const metaId = meta && typeof meta.id === "string" ? meta.id : null;

      if (!metaUuid) {
        throw new Error("MW entry missing meta.uuid (cannot persist mw_entry.entry_uuid)");
      }

      return {
        entryUuid: metaUuid,
        metaId: metaId ?? null,
        headwordRaw: cleanHeadwordRaw(headwordRawFromEntry(e)) || null,
        stems: stemsFromRawEntry(e),
        rawJson: e,
        fetchedAt: new Date(),
      };
    });
}

