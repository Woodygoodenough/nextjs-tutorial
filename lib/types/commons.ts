import { InsertLearningUnit, InsertLexicalGroup, InsertMwEntry, InsertLexicalGroupEntry, SelectLearningUnit } from "@/lib/db/schema";
type LookupKeyUpsert = { lookupKeyNorm: string; unitId: string };
export type GetUnitResult =
    | { status: "none", reason: string }
    | { status: "existing"; unit: SelectLearningUnit; lookupKeyUpsert?: LookupKeyUpsert }
    | { status: "new_in_existing_group"; unit: InsertLearningUnit; lookupKeyNorm: string }
    | { status: "new_with_new_group"; unit: InsertLearningUnit; group: InsertLexicalGroup; entries: Array<InsertMwEntry>; groupEntries: Array<InsertLexicalGroupEntry>; lookupKeyNorm: string };

