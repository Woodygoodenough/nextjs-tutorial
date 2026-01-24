CREATE TABLE IF NOT EXISTS "mw_sense" (
  "sense_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entry_uuid" uuid NOT NULL REFERENCES "mw_entry" ("entry_uuid") ON DELETE cascade,
  "scope_type" text NOT NULL,
  "scope_id" text NOT NULL,
  "vd" text,
  "kind" text NOT NULL,
  "sn" text,
  "depth" integer NOT NULL,
  "rank" integer NOT NULL,
  "fetched_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "mw_sense_scope_rank_unique" ON "mw_sense" ("entry_uuid","scope_type","scope_id","rank");
CREATE INDEX IF NOT EXISTS "mw_sense_entry_idx" ON "mw_sense" ("entry_uuid");
CREATE INDEX IF NOT EXISTS "mw_sense_scope_idx" ON "mw_sense" ("scope_type","scope_id");

CREATE TABLE IF NOT EXISTS "mw_sense_dt" (
  "dt_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sense_id" uuid NOT NULL REFERENCES "mw_sense" ("sense_id") ON DELETE cascade,
  "dt_type" text NOT NULL,
  "rank" integer NOT NULL,
  "text" text,
  "payload" jsonb,
  "fetched_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "mw_sense_dt_rank_unique" ON "mw_sense_dt" ("sense_id","rank");
CREATE INDEX IF NOT EXISTS "mw_sense_dt_sense_idx" ON "mw_sense_dt" ("sense_id");

