/**
 * @deprecated This file is kept for backward compatibility.
 * Please import from '@/app/lib/services/dao' instead, which will resolve to the index.ts file.
 * 
 * All DAO functions have been reorganized into domain-specific files:
 * - learning-units.ts: Learning units, lexical groups, lookup keys
 * - user-vocab.ts: User vocabulary management
 * - mw-dro.ts: Defined Run-Ons (DROs)
 * - mw-uro.ts: Undefined Run-Ons (UROs)
 * - mw-pronunciation.ts: Pronunciations
 */

// Re-export everything from the new structure
export * from "./dao/index";
