## Next.js App Router Course - Starter

This is the starter template for the Next.js App Router Course. It contains the starting code for the dashboard application.

For more information, see the [course curriculum](https://nextjs.org/learn) on the Next.js Website.

## Database schema

Source of truth: `app/lib/db/schema.ts` (Drizzle).

### Core dictionary tables

#### `mw_entry`
- **PK**: `entry_uuid (uuid)`
- **columns**:
  - `meta_id (text, nullable)`
  - `headword_raw (text, nullable)`
  - `stems (jsonb, nullable)`
  - `raw_json (jsonb, NOT NULL)`
  - `fetched_at (timestamptz, NOT NULL, default now())`

#### `lexical_group`
- **PK**: `group_id (uuid)`
- **unique**: `fingerprint`
- **columns**:
  - `fingerprint (text, NOT NULL)` — hash of the ordered entry UUID set
  - `created_at (timestamptz, NOT NULL, default now())`
  - `representative_entry_uuid (uuid, nullable, FK → mw_entry.entry_uuid)`

#### `lexical_group_entry`
- **PK**: `(group_id, entry_uuid)`
- **FKs**:
  - `group_id → lexical_group.group_id` (ON DELETE CASCADE)
  - `entry_uuid → mw_entry.entry_uuid` (ON DELETE CASCADE)
- **columns**:
  - `rank (int, NOT NULL)` — preserves MW ordering inside the group

#### `learning_unit`
- **PK**: `unit_id (uuid)`
- **unique**: `(group_id, label)`
- **FKs**:
  - `group_id → lexical_group.group_id` (ON DELETE CASCADE)
  - `representative_entry_uuid → mw_entry.entry_uuid`
- **columns**:
  - `label (text, NOT NULL)` — display label for the unit
  - `label_norm (text, nullable)`
  - `match_method (text, NOT NULL)` — `HEADWORD | STEM | FALLBACK`
  - `created_from_lookup_key (text, NOT NULL)`
  - `created_at (timestamptz, NOT NULL, default now())`

#### `lookup_key`
- **PK**: `lookup_key (text)`
- **FKs**:
  - `unit_id → learning_unit.unit_id` (ON DELETE CASCADE)
- **columns**:
  - `created_at (timestamptz, NOT NULL, default now())`
  - `last_seen_at (timestamptz, NOT NULL, default now())`
  - `hit_count (int, NOT NULL, default 1)`

### Auth table

#### `users`
- **PK**: `id (uuid, default uuid_generate_v4())`
- **unique**: `email`
- **columns**:
  - `name (varchar(255), NOT NULL)`
  - `email (text, NOT NULL)`
  - `password (text, NOT NULL)` — bcrypt hash
