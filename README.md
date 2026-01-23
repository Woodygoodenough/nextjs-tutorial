### Overview

This project stores Merriam‑Webster (MW) dictionary data in Postgres (via Drizzle) and builds a **Learning Unit** model that is **anchored to MW `meta.stems[]`**.

The key invariant is:

- **Every `learning_unit` points to exactly one `mw_stem` row** (via `learning_unit.stem_id`).
- `mw_stem` represents a single item from `meta.stems[]` (the only “searchable landing keys” we trust).

### Normalization rules (search + anchoring)

We normalize all “lookup keys” the same way when comparing strings:

- **NFC normalize**
- **trim**
- **lowercase**
- **strip MW formatting markers `*`** (e.g. `con*tex*tu*al` → `contextual`)

This ensures MW display formatting does not prevent a stem from anchoring to its semantic object.

### Schema (as implemented)

#### Core tables

- **`mw_entry`**
  - `entry_uuid` (PK)
  - `meta_id`, `headword_raw`
  - `stems` (JSONB array from `meta.stems`)
  - `raw_json` (full MW entry JSON)
  - `fetched_at`

- **`mw_stem`** (1 row per `meta.stems[]` item)
  - `stem_id` (PK)
  - `entry_uuid` (FK → `mw_entry`)
  - `stem` (raw string from `meta.stems[]`)
  - `stem_norm` (normalized form used for matching)
  - `anchor_kind` (enum-like string): `HWI | AHW | DRO | URO | VRS | INS | UNKNOWN`
  - `anchor_id` (polymorphic reference; UUID stored as text)
  - `fallback_warning` (boolean)
  - `rank` (index in `meta.stems[]`)
  - `fetched_at`

- **`learning_unit`** (the app’s vocabulary concept)
  - `unit_id` (PK)
  - `stem_id` (FK → `mw_stem.stem_id`) ✅ **the searchable anchor**
  - `group_id` (FK → `lexical_group.group_id`)
  - `representative_entry_uuid` (FK → `mw_entry.entry_uuid`)
  - `label` (display label for the unit)
  - `created_from_lookup_key` (string; what the user typed)
  - `created_at`

#### Semantic “owner” tables (current scope)

- **`mw_hwi`** (1 row per entry)
  - `entry_uuid` (PK/FK → `mw_entry`)
  - `hw`

- **`mw_ahw`** (alternate headwords; 0..n per entry)
  - `ahw_id` (PK)
  - `entry_uuid` (FK → `mw_entry`)
  - `hw`, `rank`

- **`mw_dro`** (defined run‑ons; 0..n per entry)
  - `dro_id` (PK)
  - `entry_uuid` (FK → `mw_entry`)
  - `drp` (phrase), `def` (JSONB), `rank`, `fetched_at`

- **`mw_uro`** (undefined run‑ons; 0..n per entry)
  - `uro_id` (PK)
  - `entry_uuid` (FK → `mw_entry`)
  - `ure` (word), `fl`, `utxt` (JSONB), `raw_json` (JSONB), `rank`, `fetched_at`

- **`mw_vr`** (variants; extracted from anywhere in `raw_json`)
  - `vr_id` (PK)
  - `entry_uuid` (FK → `mw_entry`)
  - `va`, `vl`, `rank`
  - `scope_type` (`ENTRY | DRO | URO | ...`), `scope_ref` (path token)
  - `fetched_at`

- **`mw_in`** (inflections; extracted from anywhere in `raw_json`)
  - `in_id` (PK)
  - `entry_uuid` (FK → `mw_entry`)
  - `if` (inflection), `ifc` (cutback), `il` (label), `rank`
  - `scope_type`, `scope_ref`, `fetched_at`

#### Pronunciations

- **`mw_pronunciation`** (polymorphic “owner” model)
  - `pr_id` (PK)
  - `entry_uuid` (FK → `mw_entry`)
  - `owner_type` (`HWI | AHW | DRO | URO | VRS | INS | ...`)
  - `owner_id` (UUID as text, or a path token for future sense-level owners)
  - `mw`, `pun`, `l`, `l2`
  - `sound_audio`, `sound_ref`, `sound_stat`
  - `rank` (index inside `prs[]`)
  - `fetched_at`

Note: for owners that don’t have a stable MW-provided ID (e.g. `AHW`, `VRS`, `INS`), we generate a UUID (`ahw_id` / `vr_id` / `in_id`) so pronunciations can reference them via `owner_id`.

### Workflow (unambiguous)

#### 1) User search → resolve or create a Learning Unit

1. Normalize the user input (rules above).
2. Look for an existing `mw_stem`:
   - `SELECT * FROM mw_stem WHERE stem_norm = <normalized_input> ...`
3. If there are **one or more** `learning_unit` rows whose `stem_id` points at a `mw_stem` row matching `stem_norm`:
   - If there is exactly **one** match, return it.
   - If there are **multiple** matches (ambiguous key), return the candidate set and let the user choose.
4. Otherwise (no existing matches), fetch MW entries, persist `mw_entry` rows, and build a new `learning_unit` anchored to **exactly one** `mw_stem` row.

#### 2) Persist semantic tables from `mw_entry.raw_json`

When we persist a new entry set (or run backfill):

- Extract + upsert:
  - `mw_hwi` from `raw_json.hwi`
  - `mw_ahw` from `raw_json.ahws[]`
  - `mw_dro` from `raw_json.dros[]`
  - `mw_uro` from `raw_json.uros[]`
  - `mw_vr` and `mw_in` by walking the JSON tree (excluding sense-level anchoring for now)
  - `mw_pronunciation` from `prs[]` under the owner objects we currently persist:
    - `hwi.prs` → `owner_type=HWI`, `owner_id=<entry_uuid>`
    - `ahws[].prs` → `owner_type=AHW`, `owner_id=<ahw_id>`
    - `dros[].prs` → `owner_type=DRO`, `owner_id=<dro_id>`
    - `uros[].prs` → `owner_type=URO`, `owner_id=<uro_id>`
    - `vrs[].prs` (anywhere in `raw_json`) → `owner_type=VRS`, `owner_id=<vr_id>`
    - `ins[].prs` (anywhere in `raw_json`) → `owner_type=INS`, `owner_id=<in_id>`

#### 3) Compute the stem anchor (what `mw_stem` points to)

For each `meta.stems[]` item `stem`, we choose an anchor by **exact match on normalized string** in this priority:

1. `DRO` (`mw_dro.drp`)
2. `URO` (`mw_uro.ure`)
3. `VRS` (`mw_vr.va`)
4. `INS` (`mw_in.if` / `mw_in.ifc`)
5. `AHW` (`mw_ahw.hw`)
6. `HWI` (`mw_hwi.hw`)
7. else `UNKNOWN`

If there is **no exact match**, we also try a small heuristic pass for common morphological variants **(only when the base form is also present in `meta.stems[]`)**:

- **Plurals**:
  - `...ies → ...y`
  - `...es → ...` and `...es → ...e` (e.g. `databases → database`)
  - `...s → ...` (but not `...ss`)
- **Comparatives**: `...er → ...` / `...er → ...e` (e.g. `beautifuler → beautiful`)
- **Superlatives**: `...est → ...` / `...est → ...e` (e.g. `candidest → candid`)
- **Gerunds**: `...ing → ...` / `...ing → ...e` (e.g. `databasing → database`)
- **Past tense / participles**: `...ed → ...` / `...ed → ...e` and `...ied → ...y` (e.g. `databased → database`)

We store the result on the `mw_stem` row:

- `anchor_kind` + `anchor_id`
- `fallback_warning = true` if we could not resolve the stem to any of the known owners above.

#### Stem morphological fallback (`stem-morph.ts`)

File: `lib/services/dao/stem-morph.ts`

**Problem it solves**

MW `meta.stems[]` can contain multiple surface forms (plural/comparative/gerund/etc.), while the “semantic owner” objects we persist (`mw_uro`, `mw_dro`, etc.) may use a different but related surface form. Without a fallback, those stems would incorrectly fall to `UNKNOWN` / `fallback_warning=true` even though the semantic owner exists in our persisted tables.

**Safety + invariants**

This is intentionally a *bounded heuristic*, not a full linguistic lemmatizer.

- We generate candidate “base forms” in **normalized space** (same normalization as `stem_norm`).
- We only try a candidate if it is also present in the entry’s `meta.stems[]` (guarded by a `stemNormSet`).
  - This is the key safety valve: it prevents the heuristic from inventing anchors that MW did not already assert as searchable stems.

**How it’s applied**

Both ingest paths use the same fallback logic:

- Live ingest (new MW fetch): `lib/services/dao/learning-unit-dao.ts`
- Backfill from stored JSON: `lib/services/dao/entry-backfill.ts`

They both call `morphBaseCandidates(stemNorm)` and try candidates in order until an anchor is found.

**Why it scales**

As we discover new “MW stem surface form → semantic owner surface form” patterns, we add a rule to a single function (`morphBaseCandidates`). Because both live ingest and backfill depend on it, one change fixes both:

- immediately for new data
- retrospectively for existing data by re-running backfill (`GET /lib/seed/backfill_semantics`)

**Examples that now anchor correctly**

- `tenaciousnesses → tenaciousness` (plural)
- `databases → database` (plural)
- `databasing → database` (gerund)
- `databased → database` (past tense)
- `beautifuler → beautiful` (comparative)
- `candidest → candid` (superlative)

#### Shared MW extraction helpers (`mw-extract.ts`)

File: `lib/services/dao/mw-extract.ts`

The “walk MW JSON + extract variants/inflections + extract pronunciations from `prs[]`” logic is shared between:

- `lib/services/dao/learning-unit-dao.ts` (live ingest)
- `lib/services/dao/entry-backfill.ts` (backfill)

This prevents “two slightly different parsers” drifting over time.

### Fallback and why it exists

`fallback_warning` is an **operational safety signal**.

We intentionally **do not anchor stems to sense-level structures yet**. If MW’s searchable `meta.stems[]` contains something whose best semantic match is currently only representable at a deeper level (e.g., sense-level variant/inflection we are not modeling), our resolver may not find a match.

In practice, stems commonly fail to find an anchor when the “best semantic parent” lives in parts of the entry we are not modeling as stable owners yet, for example:

- **Phrase-only text**: a phrase shown in `<phrase>` / phrase-like display fields, without a corresponding persisted owner row.
- **Sense-only “called-also” forms**: `ca` appears inside a sense/definition structure, not as an entry-level `URO/DRO/VRS/INS/AHW/HWI`.
- **Cognate cross-references**: `cxt` entries within `cxs` (cross-reference blocks) that function like links but are not persisted owners.
- **Linked word text**: an actually linked word inside `<a>` within definition markup (we don’t currently persist sense/def-level link targets as owners).
- **Related word mention without link**: related forms mentioned in prose/markup but not represented as an explicit run-on/variant/inflection owner.
- **Other def/sense structures**: cases where a “valid anchor” conceptually exists within `def`/sense JSON, but is not yet modeled in our schema.

For now we keep these stems **unanchored** (`anchor_kind=UNKNOWN`, `fallback_warning=true`) because in most cases **searching that stem directly** yields a separate MW response that is semantically richer (and easier to model) than trying to infer a sense-level anchor from nested definition markup.

In that case:

- The stem is still valid and searchable (because it came from `meta.stems[]`).
- We still create/keep the `mw_stem` row.
- We mark `fallback_warning = true` to flag “we didn’t find a best semantic parent with the current model.”

This lets the system remain correct (search still works) while clearly highlighting areas to expand later.

### Backfill (populate semantic tables from existing data)

If `learning_unit` rows already exist and you want to populate/update downstream semantic tables from stored MW JSON:

- Call: `GET /lib/seed/backfill_semantics`

It will:

- Find every `learning_unit.representative_entry_uuid`
- Read `mw_entry.raw_json` for each entry
- Populate/refresh `mw_hwi/mw_ahw/mw_dro/mw_uro/mw_vr/mw_in/mw_stem/mw_pronunciation`
  in an idempotent way (by `(entry_uuid, rank)` for stems).

