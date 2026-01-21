-- Add URO-linked pronunciations.
-- We model pronunciations at DRO or URO level (entry-level can be added later).

-- In newer schema versions, mw_pronunciation is created/migrated later. On a fresh DB,
-- ensure the legacy table exists so this migration can run, and so later migrations can
-- migrate/drop it cleanly.
CREATE TABLE IF NOT EXISTS "mw_pronunciation" (
  "pronunciation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entry_uuid" uuid NOT NULL,
  "dro_id" uuid,
  "uro_id" uuid,
  "mw" text,
  "pun" text,
  "l" text,
  "l2" text,
  "audio_base" text,
  "lang_code" text NOT NULL DEFAULT 'en',
  "country_code" text NOT NULL DEFAULT 'us',
  "rank" integer NOT NULL,
  "fetched_at" timestamptz NOT NULL DEFAULT now()
);

-- Best-effort FKs (guarded for fresh/partial installs)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'mw_entry'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mw_pronunciation_entry_uuid_fkey'
  ) THEN
    ALTER TABLE "mw_pronunciation"
    ADD CONSTRAINT "mw_pronunciation_entry_uuid_fkey"
    FOREIGN KEY ("entry_uuid") REFERENCES "mw_entry"("entry_uuid") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'mw_dro'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mw_pronunciation_dro_id_fkey'
  ) THEN
    ALTER TABLE "mw_pronunciation"
    ADD CONSTRAINT "mw_pronunciation_dro_id_fkey"
    FOREIGN KEY ("dro_id") REFERENCES "mw_dro"("dro_id") ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE "mw_pronunciation"
ADD COLUMN IF NOT EXISTS "uro_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mw_pronunciation_uro_id_fkey'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'mw_uro'
    ) THEN
      ALTER TABLE "mw_pronunciation"
      ADD CONSTRAINT "mw_pronunciation_uro_id_fkey"
      FOREIGN KEY ("uro_id") REFERENCES "mw_uro"("uro_id") ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Ensure a pronunciation belongs to at most one child scope (DRO or URO).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mw_pronunciation_one_scope_chk'
  ) THEN
    ALTER TABLE "mw_pronunciation"
    ADD CONSTRAINT "mw_pronunciation_one_scope_chk"
    CHECK (num_nonnulls("dro_id", "uro_id") <= 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "mw_pron_uro_idx" ON "mw_pronunciation" ("uro_id");

-- Replace the old (non-partial) unique index with partial unique indexes.
DROP INDEX IF EXISTS "mw_pron_entry_dro_rank_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "mw_pron_entry_dro_rank_unique"
ON "mw_pronunciation" ("entry_uuid", "dro_id", "rank")
WHERE "dro_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "mw_pron_entry_uro_rank_unique"
ON "mw_pronunciation" ("entry_uuid", "uro_id", "rank")
WHERE "uro_id" IS NOT NULL;

