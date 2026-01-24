import { sql } from "@/lib/db/client";
import { backfillEntrySemantics, backfillSemanticsForLearningUnits } from "@/lib/services/dao/entry-backfill";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") ?? "learning_units";

    if (mode === "repair_stale_hwi") {
      // Strict repair only: we do NOT do backward-compat rendering fixes.
      // We reparse entries whose stems claim HWI anchoring but have missing/incorrect anchor_id.
      const rows = await sql<Array<{ entry_uuid: string }>>`
        SELECT DISTINCT entry_uuid::text as entry_uuid
        FROM mw_stem
        WHERE anchor_kind = 'HWI'
          AND (anchor_id IS NULL OR anchor_id <> entry_uuid::text)
      `;

      const targets = Array.from(new Set(rows.map((r) => r.entry_uuid).filter(Boolean)));
      for (const entryUuid of targets) {
        await backfillEntrySemantics(entryUuid);
      }

      return Response.json({ ok: true, mode, targets: targets.length });
    }

    if (mode === "repair_headword_anchors") {
      // Repair entries where a stem that matches the headword is NOT anchored to HWI.
      // This is a hard correctness repair, not backward-compat rendering.
      const rows = await sql<Array<{ entry_uuid: string }>>`
        SELECT DISTINCT ms.entry_uuid::text as entry_uuid
        FROM mw_stem ms
        INNER JOIN mw_hwi mh ON mh.entry_uuid = ms.entry_uuid
        WHERE ms.stem_norm = lower(replace(mh.hw, '*', ''))
          AND ms.anchor_kind <> 'HWI'
      `;
      const targets = Array.from(new Set(rows.map((r) => r.entry_uuid).filter(Boolean)));
      for (const entryUuid of targets) {
        await backfillEntrySemantics(entryUuid);
      }
      return Response.json({ ok: true, mode, targets: targets.length });
    }

    if (mode === "debug_entry") {
      const metaId = url.searchParams.get("metaId");
      if (!metaId) return Response.json({ ok: false, error: "Missing metaId" }, { status: 400 });

      const entries = await sql<
        Array<{
          entry_uuid: string;
          meta_id: string | null;
          hwi_hw: string | null;
        }>
      >`
        SELECT e.entry_uuid::text as entry_uuid, e.meta_id as meta_id, h.hw as hwi_hw
        FROM mw_entry e
        LEFT JOIN mw_hwi h ON h.entry_uuid = e.entry_uuid
        WHERE e.meta_id = ${metaId}
        ORDER BY e.entry_uuid ASC
      `;

      const entryUuids = entries.map((e) => e.entry_uuid);
      const stems =
        entryUuids.length === 0
          ? []
          : await sql<
              Array<{
                entry_uuid: string;
                rank: number;
                stem: string;
                stem_norm: string;
                anchor_kind: string;
                anchor_id: string | null;
                fallback_warning: boolean;
              }>
            >`
              SELECT
                entry_uuid::text as entry_uuid,
                rank,
                stem,
                stem_norm,
                anchor_kind,
                anchor_id,
                fallback_warning
              FROM mw_stem
              WHERE entry_uuid = ANY(${sql.array(entryUuids, 2950)})
              ORDER BY entry_uuid ASC, rank ASC
            `;

      const hwiPrs =
        entryUuids.length === 0
          ? []
          : await sql<Array<{ entry_uuid: string; owner_id: string; sound_audio: string | null; rank: number }>>`
              SELECT entry_uuid::text as entry_uuid, owner_id, sound_audio, rank
              FROM mw_pronunciation
              WHERE owner_type = 'HWI'
                AND entry_uuid = ANY(${sql.array(entryUuids, 2950)})
              ORDER BY entry_uuid ASC, rank ASC
            `;

      return Response.json({ ok: true, mode, metaId, entries, stems, hwiPrs });
    }

    const r = await backfillSemanticsForLearningUnits();
    return Response.json({ ok: true, mode, ...r });
  } catch (e) {
    const err = e as any;
    const message = err instanceof Error ? err.message : String(err);
    const cause = err?.cause?.message ?? err?.cause?.toString?.();
    return Response.json(
      { ok: false, error: message, cause: cause ?? null },
      { status: 500 },
    );
  }
}

