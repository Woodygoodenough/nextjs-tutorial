-- Enforce uniqueness for entry-level (hwi.prs) pronunciations.
-- These are rows where dro_id and uro_id are both NULL.

CREATE UNIQUE INDEX IF NOT EXISTS "mw_pron_entry_rank_unique"
ON "mw_pronunciation" ("entry_uuid", "rank")
WHERE "dro_id" IS NULL AND "uro_id" IS NULL;

