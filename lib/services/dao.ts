/**
 * @deprecated This file is kept for backward compatibility.
 * Please import from '@/lib/services/dao' instead, which will resolve to the index.ts file.
 *
 * All DAO functions have been reorganized into domain-specific files:
 * - learning-unit-dao.ts: Learning units + lexical groups
 * - learning-unit-summaries.ts: Unit summaries (joins to mw_stem)
 * - entry-backfill.ts: Backfill semantic tables from stored mw_entry.raw_json
 * - user-vocab.ts: User vocabulary management
 * - mw-dro.ts: Defined Run-Ons (DROs)
 * - mw-uro.ts: Undefined Run-Ons (UROs)
 * - mw-pronunciation.ts: Pronunciations
 */
// Re-export everything from the new structure
export * from "@/lib/services/dao/index";

