import { sql } from "@/lib/db/client";
import type { SelectLearningUnit } from "@/lib/db/schema";

export type LearningUnitSummaryRow = {
  unitId: string;
  label: string;
  stem: string | null;
  stemNorm: string | null;
  anchorKind: string | null;
  createdAt: Date | null;
};

export async function fetchLearningUnitsByStemNorm(stemNorm: string): Promise<SelectLearningUnit[]> {
  return await sql<SelectLearningUnit[]>`
    select
      lu.unit_id as "unitId",
      lu.label as "label",
      lu.stem_id as "stemId",
      lu.group_id as "groupId",
      lu.representative_entry_uuid as "representativeEntryUuid",
      lu.created_from_lookup_key as "createdFromLookupKey",
      lu.created_at as "createdAt"
    from learning_unit lu
    inner join mw_stem ms on ms.stem_id = lu.stem_id
    where ms.stem_norm = ${stemNorm}
    order by lu.created_at desc, lu.unit_id;
  `;
}

export async function fetchLearningUnitSummariesByQuery(args: {
  query: string;
  limit?: number;
}): Promise<LearningUnitSummaryRow[]> {
  const q = args.query.trim();
  if (!q) return [];
  const limit = args.limit ?? 25;
  const like = `%${q}%`;

  return await sql<LearningUnitSummaryRow[]>`
    select
      lu.unit_id as "unitId",
      lu.label as "label",
      ms.stem as "stem",
      ms.stem_norm as "stemNorm",
      ms.anchor_kind as "anchorKind",
      lu.created_at as "createdAt"
    from learning_unit lu
    left join mw_stem ms on ms.stem_id = lu.stem_id
    where (lu.label ilike ${like} or ms.stem ilike ${like} or ms.stem_norm ilike ${like})
    order by lu.created_at desc
    limit ${limit};
  `;
}

export async function fetchLearningUnitSummaryByUnitId(unitId: string): Promise<Omit<LearningUnitSummaryRow, "createdAt"> | null> {
  const rows = await sql<Array<Omit<LearningUnitSummaryRow, "createdAt">>>`
    select
      lu.unit_id as "unitId",
      lu.label as "label",
      ms.stem as "stem",
      ms.stem_norm as "stemNorm",
      ms.anchor_kind as "anchorKind"
    from learning_unit lu
    left join mw_stem ms on ms.stem_id = lu.stem_id
    where lu.unit_id = ${unitId}
    limit 1;
  `;
  return rows[0] ?? null;
}

export async function fetchLearningUnitStemInfoByUnitIds(unitIds: string[]): Promise<Map<string, { stem: string | null; anchorKind: string | null }>> {
  if (unitIds.length === 0) return new Map();
  const rows = await sql<Array<{ unitId: string; stem: string | null; anchorKind: string | null }>>`
    select
      lu.unit_id as "unitId",
      ms.stem as "stem",
      ms.anchor_kind as "anchorKind"
    from learning_unit lu
    left join mw_stem ms on ms.stem_id = lu.stem_id
    where lu.unit_id = any(${sql.array(unitIds, 2950)});
  `;
  const m = new Map<string, { stem: string | null; anchorKind: string | null }>();
  for (const r of rows) m.set(r.unitId, { stem: r.stem ?? null, anchorKind: r.anchorKind ?? null });
  return m;
}

