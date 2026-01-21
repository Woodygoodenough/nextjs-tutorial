-- Introduce mw_stem + headword/alt-headword tables, and migrate pronunciations to polymorphic owner model.

-- 1) New semantic tables
CREATE TABLE IF NOT EXISTS "mw_hwi" (
  "entry_uuid" uuid PRIMARY KEY REFERENCES "mw_entry"("entry_uuid") ON DELETE CASCADE,
  "hw" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "mw_ahw" (
  "ahw_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entry_uuid" uuid NOT NULL REFERENCES "mw_entry"("entry_uuid") ON DELETE CASCADE,
  "hw" text NOT NULL,
  "rank" integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "mw_ahw_entry_rank_unique" ON "mw_ahw" ("entry_uuid", "rank");
CREATE INDEX IF NOT EXISTS "mw_ahw_entry_idx" ON "mw_ahw" ("entry_uuid");
CREATE INDEX IF NOT EXISTS "mw_ahw_hw_idx" ON "mw_ahw" ("hw");

CREATE TABLE IF NOT EXISTS "mw_vr" (
  "vr_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entry_uuid" uuid NOT NULL REFERENCES "mw_entry"("entry_uuid") ON DELETE CASCADE,
  "va" text NOT NULL,
  "vl" text,
  "rank" integer NOT NULL,
  "scope_type" text NOT NULL,
  "scope_ref" text,
  "fetched_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "mw_vr_entry_idx" ON "mw_vr" ("entry_uuid");
CREATE INDEX IF NOT EXISTS "mw_vr_va_idx" ON "mw_vr" ("va");
CREATE INDEX IF NOT EXISTS "mw_vr_scope_idx" ON "mw_vr" ("scope_type", "scope_ref");

CREATE TABLE IF NOT EXISTS "mw_in" (
  "in_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entry_uuid" uuid NOT NULL REFERENCES "mw_entry"("entry_uuid") ON DELETE CASCADE,
  "if" text,
  "ifc" text,
  "il" text,
  "rank" integer NOT NULL,
  "scope_type" text NOT NULL,
  "scope_ref" text,
  "fetched_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "mw_in_entry_idx" ON "mw_in" ("entry_uuid");
CREATE INDEX IF NOT EXISTS "mw_in_if_idx" ON "mw_in" ("if");
CREATE INDEX IF NOT EXISTS "mw_in_ifc_idx" ON "mw_in" ("ifc");
CREATE INDEX IF NOT EXISTS "mw_in_scope_idx" ON "mw_in" ("scope_type", "scope_ref");

CREATE TABLE IF NOT EXISTS "mw_stem" (
  "stem_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entry_uuid" uuid NOT NULL REFERENCES "mw_entry"("entry_uuid") ON DELETE CASCADE,
  "stem" text NOT NULL,
  "stem_norm" text NOT NULL,
  "anchor_kind" text NOT NULL,
  "anchor_id" text,
  "fallback_warning" boolean NOT NULL DEFAULT false,
  "rank" integer NOT NULL,
  "fetched_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "mw_stem_entry_rank_unique" ON "mw_stem" ("entry_uuid", "rank");
CREATE INDEX IF NOT EXISTS "mw_stem_norm_idx" ON "mw_stem" ("stem_norm");
CREATE INDEX IF NOT EXISTS "mw_stem_entry_idx" ON "mw_stem" ("entry_uuid");

-- 2) learning_unit now anchors to mw_stem
ALTER TABLE "learning_unit"
ADD COLUMN IF NOT EXISTS "stem_id" uuid;

-- Backfill existing learning units with stem rows in an idempotent way.
-- We attempt to map each learning unit label to the matching meta.stems[] index (rank) if possible.
INSERT INTO "mw_stem" ("stem_id", "entry_uuid", "stem", "stem_norm", "anchor_kind", "anchor_id", "fallback_warning", "rank", "fetched_at")
SELECT DISTINCT ON (entry_uuid, rank)
  gen_random_uuid() as stem_id,
  entry_uuid,
  stem,
  lower(trim(stem)) as stem_norm,
  anchor_kind,
  anchor_id,
  false as fallback_warning,
  rank,
  now() as fetched_at
FROM (
  SELECT
    lu."representative_entry_uuid" as entry_uuid,
    COALESCE(m.stem, lu."label") as stem,
    COALESCE(m.rank, 0) as rank,
    COALESCE(lu."match_method", 'UNKNOWN') as anchor_kind,
    NULL as anchor_id
  FROM "learning_unit" lu
  LEFT JOIN "mw_entry" me ON me."entry_uuid" = lu."representative_entry_uuid"
  LEFT JOIN LATERAL (
    SELECT
      (t.ordinality - 1)::int as rank,
      t.value as stem
    FROM jsonb_array_elements_text(me."stems") WITH ORDINALITY AS t(value, ordinality)
    WHERE lower(trim(t.value)) = lower(trim(lu."label"))
    LIMIT 1
  ) m ON true
  WHERE lu."stem_id" IS NULL
) x
ON CONFLICT ("entry_uuid", "rank") DO NOTHING;

-- Now attach each learning unit to the matching mw_stem row.
WITH desired AS (
  SELECT
    lu."unit_id" as unit_id,
    lu."representative_entry_uuid" as entry_uuid,
    COALESCE((
      SELECT (t.ordinality - 1)::int
      FROM jsonb_array_elements_text(me."stems") WITH ORDINALITY AS t(value, ordinality)
      WHERE lower(trim(t.value)) = lower(trim(lu."label"))
      LIMIT 1
    ), 0) as rank
  FROM "learning_unit" lu
  LEFT JOIN "mw_entry" me ON me."entry_uuid" = lu."representative_entry_uuid"
  WHERE lu."stem_id" IS NULL
)
UPDATE "learning_unit" lu
SET "stem_id" = ms."stem_id"
FROM desired d
JOIN "mw_stem" ms ON ms."entry_uuid" = d.entry_uuid AND ms."rank" = d.rank
WHERE lu."unit_id" = d.unit_id
  AND lu."stem_id" IS NULL;

ALTER TABLE "learning_unit"
ALTER COLUMN "stem_id" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'learning_unit_stem_id_fkey'
  ) THEN
    ALTER TABLE "learning_unit"
    ADD CONSTRAINT "learning_unit_stem_id_fkey"
    FOREIGN KEY ("stem_id") REFERENCES "mw_stem"("stem_id") ON DELETE RESTRICT;
  END IF;
END $$;

-- 3) Migrate mw_pronunciation to polymorphic owner model (preserve existing data)
-- Drop legacy indexes if present.
DROP INDEX IF EXISTS "mw_pron_entry_rank_unique";
DROP INDEX IF EXISTS "mw_pron_entry_dro_rank_unique";
DROP INDEX IF EXISTS "mw_pron_entry_uro_rank_unique";
DROP INDEX IF EXISTS "mw_pron_audio_base_idx";
DROP INDEX IF EXISTS "mw_pron_uro_idx";

CREATE TABLE IF NOT EXISTS "mw_pronunciation_new" (
  "pr_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entry_uuid" uuid NOT NULL REFERENCES "mw_entry"("entry_uuid") ON DELETE CASCADE,
  "owner_type" text NOT NULL,
  "owner_id" text NOT NULL,
  "mw" text,
  "pun" text,
  "l" text,
  "l2" text,
  "sound_audio" text,
  "sound_ref" text,
  "sound_stat" text,
  "rank" integer NOT NULL,
  "fetched_at" timestamptz NOT NULL DEFAULT now()
);

-- If old table exists, migrate rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'mw_pronunciation'
  ) THEN
    INSERT INTO "mw_pronunciation_new" (
      "pr_id","entry_uuid","owner_type","owner_id","mw","pun","l","l2","sound_audio","sound_ref","sound_stat","rank","fetched_at"
    )
    SELECT
      COALESCE("pronunciation_id", gen_random_uuid()) as pr_id,
      "entry_uuid",
      CASE
        WHEN "dro_id" IS NOT NULL THEN 'DRO'
        WHEN "uro_id" IS NOT NULL THEN 'URO'
        ELSE 'HWI'
      END as owner_type,
      CASE
        WHEN "dro_id" IS NOT NULL THEN "dro_id"::text
        WHEN "uro_id" IS NOT NULL THEN "uro_id"::text
        ELSE "entry_uuid"::text
      END as owner_id,
      "mw",
      "pun",
      "l",
      "l2",
      "audio_base" as sound_audio,
      NULL as sound_ref,
      NULL as sound_stat,
      "rank",
      COALESCE("fetched_at", now())
    FROM "mw_pronunciation"
    ON CONFLICT DO NOTHING;

    DROP TABLE "mw_pronunciation";
  END IF;
END $$;

ALTER TABLE "mw_pronunciation_new" RENAME TO "mw_pronunciation";

CREATE UNIQUE INDEX IF NOT EXISTS "mw_pron_owner_rank_unique"
ON "mw_pronunciation" ("owner_type","owner_id","rank");
CREATE INDEX IF NOT EXISTS "mw_pron_owner_idx"
ON "mw_pronunciation" ("owner_type","owner_id");
CREATE INDEX IF NOT EXISTS "mw_pron_entry_idx"
ON "mw_pronunciation" ("entry_uuid");
CREATE INDEX IF NOT EXISTS "mw_pron_sound_audio_idx"
ON "mw_pronunciation" ("sound_audio");

