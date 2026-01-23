import { InsertLearningUnit, InsertLexicalGroup, InsertMwEntry, InsertLexicalGroupEntry, SelectLearningUnit } from "@/lib/db/schema";
export type GetUnitResult =
    | { status: "none", reason: string }
    | { status: "candidates"; candidates: Array<SelectLearningUnit>; lookupKeyNorm: string }
    | { status: "existing"; unit: SelectLearningUnit }
    | { status: "new_in_existing_group"; unit: InsertLearningUnit; entries: Array<InsertMwEntry>; groupEntries: Array<InsertLexicalGroupEntry>; lookupKeyNorm: string }
    | { status: "new_with_new_group"; unit: InsertLearningUnit; group: InsertLexicalGroup; entries: Array<InsertMwEntry>; groupEntries: Array<InsertLexicalGroupEntry>; lookupKeyNorm: string };

