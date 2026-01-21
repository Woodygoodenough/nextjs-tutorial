-- Ensure mw_dro and mw_uro tables exist (required for stem anchoring + pronunciations).

CREATE TABLE IF NOT EXISTS "mw_dro" (
  "dro_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entry_uuid" uuid NOT NULL REFERENCES "mw_entry"("entry_uuid") ON DELETE CASCADE,
  "drp" text NOT NULL,
  "rank" integer NOT NULL,
  "def" jsonb NOT NULL,
  "fetched_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "mw_dro_entry_rank_unique" ON "mw_dro" ("entry_uuid","rank");
CREATE INDEX IF NOT EXISTS "mw_dro_entry_idx" ON "mw_dro" ("entry_uuid");
CREATE INDEX IF NOT EXISTS "mw_dro_drp_idx" ON "mw_dro" ("drp");

CREATE TABLE IF NOT EXISTS "mw_uro" (
  "uro_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entry_uuid" uuid NOT NULL REFERENCES "mw_entry"("entry_uuid") ON DELETE CASCADE,
  "ure" text NOT NULL,
  "fl" text NOT NULL,
  "rank" integer NOT NULL,
  "utxt" jsonb,
  "raw_json" jsonb,
  "fetched_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "mw_uro_entry_rank_unique" ON "mw_uro" ("entry_uuid","rank");
CREATE INDEX IF NOT EXISTS "mw_uro_entry_idx" ON "mw_uro" ("entry_uuid");
CREATE INDEX IF NOT EXISTS "mw_uro_ure_idx" ON "mw_uro" ("ure");

