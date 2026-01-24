# Next.js Merriam-Webster Vocabulary Learning App

## Overview

This project stores Merriam‑Webster (MW) dictionary data in Postgres (via Drizzle ORM) and builds a **Learning Unit** model that is **anchored to MW `meta.stems[]`**.

### Core Architectural Invariant

**Every `learning_unit` points to exactly one `mw_stem` row** (via `learning_unit.stem_id`).

- `mw_stem` represents a single item from `meta.stems[]` (the only "searchable landing keys" we trust from MW).
- This ensures that every vocabulary item the user learns is traceable back to a MW-asserted searchable term.
- The `mw_stem` row also stores which semantic "owner" (HWI/AHW/DRO/URO/VRS/INS) it anchors to, enabling pronunciation lookup and definition rendering.

### Why Stem-Anchored?

MW's `meta.stems[]` is the **canonical list of searchable terms** for an entry. When a user searches "mercury", MW returns entries where "mercury" (or a variant) appears in `meta.stems[]`. By anchoring our learning units to these stems, we:

1. **Preserve MW's search semantics**: If MW says "Mercury" and "mercury" are both searchable stems, we can represent both.
2. **Enable accurate pronunciation lookup**: Each stem anchors to a semantic owner (HWI/AHW/etc.), and pronunciations are stored per-owner.
3. **Support morphological variants**: Stems like "tenaciousnesses" can anchor to "tenaciousness" via morphological fallback, while still preserving the exact MW stem string.

---

## Normalization Rules

### For Search & Matching (`stem_norm`)

All lookup keys and stem comparisons use **case-insensitive normalization**:

1. **Strip MW formatting markers `*`** (e.g., `con*tex*tu*al` → `contextual`)
2. **NFC normalize** (Unicode canonical form)
3. **Trim whitespace**
4. **Lowercase** (for matching only; original casing preserved in `mw_stem.stem`)

**Example**: `"Mer*cu*ry"` → `stem_norm = "mercury"` (for matching), but `stem = "Mer*cu*ry"` (preserved).

### For Display & User Input (`created_from_lookup_key`)

When a user searches, we preserve **only the first letter's case** and lowercase the rest:

- `"Mercury"` → stored as `"Mercury"` (canonicalized)
- `"MERCURY"` → stored as `"Mercury"` (canonicalized)
- `"mercury"` → stored as `"mercury"` (canonicalized)
- `"mERCURY"` → stored as `"mercury"` (random caps ignored)

This allows us to:
- Match user intent (capitalized proper nouns vs. lowercase common nouns)
- Select the correct `meta.stems[]` variant when creating a learning unit
- Display consistent labels in the UI

**Implementation**: `canonicalizeLookupFirstLetterCase()` in `lib/services/learning-unit-search.ts` and `lib/services/dao/learning-unit-dao.ts`.

---

## Schema (Complete)

### Core Tables

#### `mw_entry`
- `entry_uuid` (PK, UUID)
- `meta_id` (text, e.g., "mercury")
- `headword_raw` (text, e.g., "mer*cu*ry")
- `stems` (JSONB array from `meta.stems[]`, e.g., `["Mercuries", "Mercury", "mercuries", "mercury", "quicksilver"]`)
- `raw_json` (JSONB, full MW entry JSON)
- `fetched_at` (timestamp)

**Purpose**: Stores the raw MW API response. All downstream semantic tables are derived from `raw_json`.

#### `mw_stem` (1 row per `meta.stems[]` item)
- `stem_id` (PK, UUID)
- `entry_uuid` (FK → `mw_entry.entry_uuid`)
- `stem` (text, raw string from `meta.stems[]`, e.g., `"Mercury"`)
- `stem_norm` (text, normalized for matching, e.g., `"mercury"`)
- `anchor_kind` (text enum): `HWI | AHW | DRO | URO | VRS | INS | UNKNOWN`
- `anchor_id` (text, polymorphic reference; UUID stored as text)
  - For `HWI`: `anchor_id = entry_uuid`
  - For `AHW`: `anchor_id = ahw_id`
  - For `DRO`: `anchor_id = dro_id`
  - For `URO`: `anchor_id = uro_id`
  - For `VRS`: `anchor_id = vr_id`
  - For `INS`: `anchor_id = in_id`
  - For `UNKNOWN`: `anchor_id = NULL`
- `fallback_warning` (boolean, `true` if no anchor found)
- `rank` (integer, index in `meta.stems[]`, 0-based)
- `fetched_at` (timestamp)

**Unique constraint**: `(entry_uuid, rank)` — each entry's stems are uniquely identified by their position in `meta.stems[]`.

**Indexes**:
- `mw_stem_norm_idx` on `stem_norm` (for search lookups)
- `mw_stem_entry_idx` on `entry_uuid` (for entry-level queries)

#### `learning_unit` (the app's vocabulary concept)
- `unit_id` (PK, UUID)
- `stem_id` (FK → `mw_stem.stem_id`) ✅ **the searchable anchor**
- `group_id` (FK → `lexical_group.group_id`)
- `representative_entry_uuid` (FK → `mw_entry.entry_uuid`)
- `label` (text, display label, e.g., `"Mercury"` or `"mercury"` — matches selected `mw_stem.stem` after stripping `*`)
- `created_from_lookup_key` (text, canonicalized user input, e.g., `"Mercury"` or `"mercury"`)
- `created_at` (timestamp)

**Unique constraint**: `(group_id, label)` — prevents duplicate units within the same lexical group.

**Purpose**: Represents a single vocabulary item the user wants to learn. The `stem_id` links to the exact MW stem term, enabling pronunciation and definition lookup.

#### `lexical_group`
- `group_id` (PK, UUID)
- `fingerprint` (text, SHA256 hash of sorted `entry_uuid` list)
- `created_at` (timestamp)

**Purpose**: Groups related MW entries (e.g., "mercury" noun and "mercury" verb) into a single conceptual unit. Multiple `learning_unit` rows can share the same `group_id` if they represent different stems from the same entry set.

#### `lexical_group_entry`
- `group_id` (FK → `lexical_group.group_id`)
- `entry_uuid` (FK → `mw_entry.entry_uuid`)
- `rank` (integer, ordering within group)

**Composite PK**: `(group_id, entry_uuid)`

**Purpose**: Links entries to their lexical group. The `rank` preserves MW's ordering.

### Semantic "Owner" Tables

These tables represent MW's semantic structure. Each row can "own" pronunciations and can be referenced by `mw_stem.anchor_id`.

#### `mw_hwi` (Headword Info, 1 row per entry)
- `entry_uuid` (PK/FK → `mw_entry.entry_uuid`)
- `hw` (text, e.g., `"mer*cu*ry"`)

**Purpose**: The primary headword. Most entries have exactly one HWI. Stems matching `hwi.hw` (normalized) should anchor to `HWI` with `anchor_id = entry_uuid`.

#### `mw_ahw` (Alternate Headwords, 0..n per entry)
- `ahw_id` (PK, UUID)
- `entry_uuid` (FK → `mw_entry.entry_uuid`)
- `hw` (text)
- `rank` (integer, ordering)

**Unique constraint**: `(entry_uuid, rank)`

**Purpose**: Alternative spellings/forms of the headword. Stems matching `ahw.hw` anchor to `AHW` with `anchor_id = ahw_id`.

#### `mw_dro` (Defined Run-Ons, 0..n per entry)
- `dro_id` (PK, UUID)
- `entry_uuid` (FK → `mw_entry.entry_uuid`)
- `drp` (text, phrase, e.g., `"mercury chloride"`)
- `def` (JSONB, definition structure)
- `rank` (integer, ordering)
- `fetched_at` (timestamp)

**Unique constraint**: `(entry_uuid, rank)`

**Purpose**: Phrasal entries defined within the main entry. Stems matching `dro.drp` anchor to `DRO` with `anchor_id = dro_id`.

#### `mw_uro` (Undefined Run-Ons, 0..n per entry)
- `uro_id` (PK, UUID)
- `entry_uuid` (FK → `mw_entry.entry_uuid`)
- `ure` (text, word, e.g., `"tenaciousness"`)
- `fl` (text, functional label, e.g., `"noun"`)
- `utxt` (JSONB, optional text section)
- `raw_json` (JSONB, full URO object)
- `rank` (integer, ordering)
- `fetched_at` (timestamp)

**Unique constraint**: `(entry_uuid, rank)`

**Purpose**: Word forms derived from the headword but not fully defined (e.g., "tenaciousness" from "tenacious"). Stems matching `uro.ure` anchor to `URO` with `anchor_id = uro_id`.

#### `mw_vr` (Variants, extracted from anywhere in `raw_json`)
- `vr_id` (PK, UUID)
- `entry_uuid` (FK → `mw_entry.entry_uuid`)
- `va` (text, variant form)
- `vl` (text, variant label, optional)
- `rank` (integer, ordering within scope)
- `scope_type` (text, e.g., `"ENTRY"`, `"DRO"`, `"URO"`)
- `scope_ref` (text, JSONPath-like reference)
- `fetched_at` (timestamp)

**Purpose**: Spelling/regional variants (e.g., "color" vs. "colour"). Extracted by walking `raw_json`. Stems matching `vr.va` anchor to `VRS` with `anchor_id = vr_id`.

#### `mw_in` (Inflections, extracted from anywhere in `raw_json`)
- `in_id` (PK, UUID)
- `entry_uuid` (FK → `mw_entry.entry_uuid`)
- `if` (text, inflection form, e.g., `"focused"`)
- `ifc` (text, cutback form, optional)
- `il` (text, inflection label, optional)
- `rank` (integer, ordering within scope)
- `scope_type` (text, e.g., `"ENTRY"`, `"DRO"`, `"URO"`)
- `scope_ref` (text, JSONPath-like reference)
- `fetched_at` (timestamp)

**Purpose**: Inflected forms (e.g., "focuses", "focusing", "focussed"). Extracted by walking `raw_json`. Stems matching `in.if` or `in.ifc` anchor to `INS` with `anchor_id = in_id`.

### Pronunciation System

#### `mw_pronunciation` (polymorphic "owner" model)
- `pr_id` (PK, UUID)
- `entry_uuid` (FK → `mw_entry.entry_uuid`)
- `owner_type` (text enum): `HWI | AHW | DRO | URO | VRS | INS | ...`
- `owner_id` (text, UUID as text, or path token for future sense-level owners)
- `mw` (text, pronunciation text, e.g., `"ˈmər-kyə-rē"`)
- `pun` (text, punctuation, optional)
- `l` (text, label, optional)
- `l2` (text, secondary label, optional)
- `sound_audio` (text, base filename, e.g., `"mercur09"`)
- `sound_ref` (text, reference, optional)
- `sound_stat` (text, status, optional)
- `rank` (integer, index inside `prs[]`, 0-based)
- `fetched_at` (timestamp)

**Unique constraint**: `(owner_type, owner_id, rank)` — each owner's pronunciations are ordered.

**Indexes**:
- `mw_pron_owner_idx` on `(owner_type, owner_id)` (for audio lookup)
- `mw_pron_entry_idx` on `entry_uuid` (for entry-level queries)
- `mw_pron_sound_audio_idx` on `sound_audio` (for CDN URL generation)

**Purpose**: Stores pronunciations from MW's `prs[]` arrays. Each pronunciation belongs to a semantic owner (HWI/AHW/DRO/URO/VRS/INS). To get audio for a stem:

1. Look up `mw_stem` row → get `anchor_kind` and `anchor_id`
2. Query `mw_pronunciation` WHERE `owner_type = anchor_kind` AND `owner_id = anchor_id`
3. Use the first row's `sound_audio` to construct MW CDN URL

**Audio URL Construction**: `https://media.merriam-webster.com/audio/prons/[language]/[subdirectory]/[sound_audio].mp3`
- Language: `en` (English) or `es` (Spanish) from `l`/`l2`
- Subdirectory: derived from `sound_ref` (e.g., `"c"` → `"c000001"`)
- See `components/pronunciation-button.tsx` → `mwAudioUrlFromBaseFilename()`

### Normalized Definition Tables

#### `mw_sense` (sense structure, hierarchical)
- `sense_id` (PK, UUID)
- `entry_uuid` (FK → `mw_entry.entry_uuid`)
- `scope_type` (text enum): `ENTRY | DRO`
- `scope_id` (text, polymorphic):
  - For `ENTRY`: `scope_id = entry_uuid`
  - For `DRO`: `scope_id = dro_id`
- `vd` (text, verb divider, optional, e.g., `"transitive verb"`)
- `kind` (text enum): `sense | sen | bs | pseq`
- `sn` (text, sense number, optional, e.g., `"1"`, `"a"`, `"(2)"`)
- `depth` (integer, hierarchy depth, 0 = top-level)
- `rank` (integer, ordering within scope)
- `fetched_at` (timestamp)

**Unique constraint**: `(entry_uuid, scope_type, scope_id, rank)`

**Purpose**: Flattened, normalized representation of MW's definition structure (`def`, `sseq`, `sense`, `bs`, `pseq`). Avoids parsing raw JSON downstream.

#### `mw_sense_dt` (definition text items)
- `dt_id` (PK, UUID)
- `sense_id` (FK → `mw_sense.sense_id`)
- `dt_type` (text enum): `text | vis | ca | uns | snote | ri | bnw | ...`
- `rank` (integer, ordering within sense)
- `text` (text, normalized plain text, nullable)
- `payload` (JSONB, structured data for examples/called-also/etc., nullable)
- `fetched_at` (timestamp)

**Unique constraint**: `(sense_id, rank)`

**Purpose**: Stores definition text items (`dt` elements) from MW's sense structure. The `text` field contains normalized plain text (MW formatting markers stripped). The `payload` stores structured data for complex items (examples, called-also lists, etc.).

**Parsing**: See `lib/services/dao/mw-def-parse.ts` → `parseMwDefinitions()` and `mwTextToPlain()`.

### User Progress Tables

#### `user_vocab`
- `user_id` (FK → `users.id`)
- `unit_id` (FK → `learning_unit.unit_id`)
- `created_at` (timestamp)
- `last_reviewed_at` (timestamp)
- `next_review_at` (timestamp, nullable)
- `progress` (integer, 0-100, default 0)
- `recent_mastery` (integer, nullable: `0` = failed, `1` = passed, `NULL` = not reviewed)

**Composite PK**: `(user_id, unit_id)`

**Purpose**: Tracks user's learning progress for each vocabulary unit. Used by the review scheduler (`domain/review/scheduler.ts`).

---

## Data Flow & Workflows

### 1. User Search → Resolve or Create Learning Unit

**Entry point**: `lib/services/learning-unit-search.ts` → `searchMW(lookupKey: string)`

**Steps**:

1. **Normalize user input**:
   - Strip `*`, NFC normalize, trim → `lookupDisplay`
   - Canonicalize first-letter case → `lookupCaseKey` (e.g., `"Mercury"` or `"mercury"`)
   - Lowercase → `lookupLower` (for DB lookup)

2. **Check existing units**:
   - Query `mw_stem` WHERE `stem_norm = lookupLower`
   - Join to `learning_unit` via `stem_id`
   - If exactly **one** match → return `{ status: "existing", unit }`
   - If **multiple** matches → return `{ status: "candidates", candidates }` (let user choose)

3. **Fetch from MW API** (if no existing match):
   - Call MW API with `lookupLower` (MW normalizes queries internally)
   - Parse response → `InsertMwEntry[]` (see `lib/services/mw-parse.ts`)

4. **Select representation** (`pickRepresentation()`):
   - For each entry, find stems matching `lookupLower` (case-insensitive)
   - If `lookupCaseKey` starts uppercase, prefer uppercase-first stems; else prefer lowercase-first
   - Select the matching stem → use it as `label` and `representative_entry_uuid`

5. **Persist** (`upsertLearningUnit()`):
   - Insert `mw_entry` rows
   - Insert semantic tables (`mw_hwi`, `mw_ahw`, `mw_dro`, `mw_uro`, `mw_vr`, `mw_in`)
   - Insert `mw_pronunciation` rows (from `prs[]` arrays)
   - Insert `mw_stem` rows (one per `meta.stems[]` item, with anchors computed)
   - Insert `lexical_group` and `lexical_group_entry` rows
   - Insert `learning_unit` row (with `stem_id` pointing to selected `mw_stem`)

**Key files**:
- `lib/services/learning-unit-search.ts` (orchestration)
- `lib/services/mw-client.ts` (MW API calls)
- `lib/services/mw-parse.ts` (raw JSON → `InsertMwEntry`)
- `lib/services/dao/learning-unit-dao.ts` (persistence)

### 2. Stem Anchoring Logic

**Entry point**: `lib/services/dao/learning-unit-dao.ts` → `upsertLearningUnit()` (live ingest) or `lib/services/dao/entry-backfill.ts` → `backfillEntrySemantics()` (backfill)

**For each `meta.stems[]` item**:

1. **Normalize stem**: `stem_norm = normKey(stem)` (lowercase, strip `*`, NFC, trim)

2. **Try exact match** (priority order):
   - `DRO` (`mw_dro.drp` normalized)
   - `URO` (`mw_uro.ure` normalized)
   - `VRS` (`mw_vr.va` normalized)
   - `INS` (`mw_in.if` or `mw_in.ifc` normalized)
   - `AHW` (`mw_ahw.hw` normalized)
   - **`HWI`** (`mw_hwi.hw` normalized) ← **highest priority for headword matches**
   - `UNKNOWN` (if no match)

3. **If no exact match, try morphological fallback** (`morphBaseCandidates()`):
   - Only if the candidate base form exists in `meta.stems[]` (safety guard)
   - Rules: plurals (`...ies → ...y`, `...es → ...`, `...s → ...`), comparatives (`...er → ...`), superlatives (`...est → ...`), gerunds (`...ing → ...`), past tense (`...ed → ...`, `...ied → ...y`)
   - Try candidates in order until an anchor is found

4. **Store result**:
   - `anchor_kind` = matched owner type
   - `anchor_id` = matched owner ID (or `NULL` if `UNKNOWN`)
   - `fallback_warning = true` if no anchor found

**Key files**:
- `lib/services/dao/stem-morph.ts` (morphological rules)
- `lib/services/dao/mw-extract.ts` (normalization helpers)

**Important**: HWI anchoring takes precedence over VRS/INS when a stem matches the headword. This ensures headword stems get pronunciations from `hwi.prs[]` rather than variant/inflection `prs[]` (which may not exist).

### 3. Entry Title Selection (UI Rendering)

**Entry point**: `lib/actions/library.ts` → `getWordDetail(unitId: string)`

**For each entry in the lexical group**:

1. **Get headword**: `headDisplay = mwDisplayTerm(hwiHw ?? headwordRaw)`

2. **Find matching stem** (priority order):
   - **Exact case-sensitive match**: Find stem where `mwDisplayTerm(stem) === headDisplay`
   - **Case-insensitive match with first-letter preference**:
     - If headword starts uppercase → prefer uppercase-first stems
     - If headword starts lowercase → prefer lowercase-first stems
   - **Any case-insensitive match**: Fall back to any matching stem
   - **Last resort**: Use `headDisplay` or first stem

3. **Store as `titleStem`**: This becomes the entry title in the UI.

4. **Filter stems list**: Hide any stem whose `mwDisplayTerm(stem) === titleStem` (prevents duplicate display).

**Purpose**: Ensures entry titles match MW's headword capitalization exactly. If `hwi.hw` is `"mercury"`, the title is `"mercury"` (not `"Mercury"`).

**Key files**:
- `lib/actions/library.ts` (title selection logic)
- `app/dashboard/library/words/[id]/page.tsx` (UI rendering)

### 4. Pronunciation Lookup & Rendering

**For library list** (`getUserLibraryUnits()`):

1. Join `learning_unit` → `mw_stem` (via `stem_id`)
2. Join `mw_pronunciation` WHERE `owner_type = mw_stem.anchor_kind` AND `owner_id = mw_stem.anchor_id`
3. Select first `sound_audio` (ordered by `rank`)
4. Pass to `PronunciationButton` component

**For word detail page** (`getWordDetail()`):

1. **Batch fetch pronunciations**:
   - Collect all `(owner_type, owner_id)` pairs from entry stems
   - Also include HWI owners for each entry (for entry title audio)
   - Query `mw_pronunciation` in batches per `owner_type`
   - Build `Map<"${owner_type}:${owner_id}", sound_audio>`

2. **Map to stems**:
   - For each stem: `soundAudio = ownerAudio.get("${anchorKind}:${anchorId}") ?? null`
   - For entry title: `hwiSoundAudio = ownerAudio.get("HWI:${entryUuid}") ?? null`

3. **Render**:
   - Entry title gets `PronunciationButton` with `hwiSoundAudio`
   - Each stem row gets `PronunciationButton` with its `soundAudio`
   - Button is disabled/grayed if `soundAudio === null`

**Key files**:
- `lib/actions/library.ts` (pronunciation queries)
- `components/pronunciation-button.tsx` (audio playback + URL construction)

### 5. Definition Rendering

**Entry point**: `lib/actions/library.ts` → `getWordDetail()`

**Steps**:

1. **Fetch normalized definitions**:
   - Query `mw_sense` WHERE `entry_uuid IN (...)` ORDER BY `entry_uuid, scope_type, scope_id, rank`
   - Query `mw_sense_dt` WHERE `sense_id IN (...)` ORDER BY `sense_id, rank`
   - Group `dt` items by `sense_id`

2. **Organize by scope**:
   - Group senses by `(scope_type, scope_id)` → `scopes[]`
   - For `DRO` scopes, fetch `mw_dro.drp` as label
   - Sort: `ENTRY` scopes first, then `DRO` scopes by rank

3. **Render**:
   - Each scope → section header (e.g., "Definitions" or "Run-on: mercury chloride")
   - Each sense → sense number (`sn`), verb divider (`vd`), definition text items (`dt`)
   - Each `dt` item → render based on `dt_type`:
     - `text` → plain text paragraph
     - `vis` → examples list
     - `ca` → "called also" text
     - `uns` → usage notes

**Key files**:
- `lib/actions/library.ts` (definition queries)
- `app/dashboard/library/words/[id]/page.tsx` (UI rendering, `renderDtItem()`)

---

## Stem Morphological Fallback

**File**: `lib/services/dao/stem-morph.ts`

### Problem It Solves

MW `meta.stems[]` can contain multiple surface forms (plural/comparative/gerund/etc.), while the "semantic owner" objects we persist (`mw_uro`, `mw_dro`, etc.) may use a different but related surface form. Without a fallback, those stems would incorrectly fall to `UNKNOWN` / `fallback_warning=true` even though the semantic owner exists in our persisted tables.

**Example**: `meta.stems[]` contains `"tenaciousnesses"` (plural), but `mw_uro.ure` is `"tenaciousness"` (singular). Without fallback, `"tenaciousnesses"` would be `UNKNOWN`. With fallback, it anchors to the `URO` row.

### Safety + Invariants

This is intentionally a **bounded heuristic**, not a full linguistic lemmatizer.

- We generate candidate "base forms" in **normalized space** (same normalization as `stem_norm`).
- We only try a candidate if it is also present in the entry's `meta.stems[]` (guarded by a `stemNormSet`).
  - This is the key safety valve: it prevents the heuristic from inventing anchors that MW did not already assert as searchable stems.

### How It's Applied

Both ingest paths use the same fallback logic:

- **Live ingest** (new MW fetch): `lib/services/dao/learning-unit-dao.ts`
- **Backfill** from stored JSON: `lib/services/dao/entry-backfill.ts`

They both call `morphBaseCandidates(stemNorm)` and try candidates in order until an anchor is found.

### Morphological Rules

- **Plurals**:
  - `...ies → ...y` (e.g., `"tenaciousnesses" → "tenaciousness"`)
  - `...es → ...` and `...es → ...e` (e.g., `"databases → database"`)
  - `...s → ...` (but not `...ss`, e.g., `"focuses → focus"` but not `"focusses → focuss"`)
- **Comparatives**: `...er → ...` / `...er → ...e` (e.g., `"beautifuler → beautiful"`)
- **Superlatives**: `...est → ...` / `...est → ...e` (e.g., `"candidest → candid"`)
- **Gerunds**: `...ing → ...` / `...ing → ...e` (e.g., `"databasing → database"`)
- **Past tense / participles**: `...ed → ...` / `...ed → ...e` and `...ied → ...y` (e.g., `"databased → database"`)
- **Double-consonant collapse**: `...sses → ...ss` → `...s` (e.g., `"focusses → focuss → focus"`)

### Why It Scales

As we discover new "MW stem surface form → semantic owner surface form" patterns, we add a rule to a single function (`morphBaseCandidates`). Because both live ingest and backfill depend on it, one change fixes both:

- immediately for new data
- retrospectively for existing data by re-running backfill (`GET /lib/seed/backfill_semantics`)

### Examples That Now Anchor Correctly

- `tenaciousnesses → tenaciousness` (plural)
- `databases → database` (plural)
- `databasing → database` (gerund)
- `databased → database` (past tense)
- `beautifuler → beautiful` (comparative)
- `candidest → candid` (superlative)
- `focusses → focus` (double-consonant collapse)

---

## Fallback Warning & Unanchored Stems

`fallback_warning` is an **operational safety signal**.

We intentionally **do not anchor stems to sense-level structures yet**. If MW's searchable `meta.stems[]` contains something whose best semantic match is currently only representable at a deeper level (e.g., sense-level variant/inflection we are not modeling), our resolver may not find a match.

### Common Cases Where Stems Remain Unanchored

- **Phrase-only text**: a phrase shown in `<phrase>` / phrase-like display fields, without a corresponding persisted owner row.
- **Sense-only "called-also" forms**: `ca` appears inside a sense/definition structure, not as an entry-level `URO/DRO/VRS/INS/AHW/HWI`.
- **Cognate cross-references**: `cxt` entries within `cxs` (cross-reference blocks) that function like links but are not persisted owners.
- **Linked word text**: an actually linked word inside `<a>` within definition markup (we don't currently persist sense/def-level link targets as owners).
- **Related word mention without link**: related forms mentioned in prose/markup but not represented as an explicit run-on/variant/inflection owner.
- **Other def/sense structures**: cases where a "valid anchor" conceptually exists within `def`/sense JSON, but is not yet modeled in our schema.

### Why We Keep Them Unanchored

For now we keep these stems **unanchored** (`anchor_kind=UNKNOWN`, `fallback_warning=true`) because in most cases **searching that stem directly** yields a separate MW response that is semantically richer (and easier to model) than trying to infer a sense-level anchor from nested definition markup.

In that case:

- The stem is still valid and searchable (because it came from `meta.stems[]`).
- We still create/keep the `mw_stem` row.
- We mark `fallback_warning = true` to flag "we didn't find a best semantic parent with the current model."

This lets the system remain correct (search still works) while clearly highlighting areas to expand later.

---

## Backfill & Repair Modes

### Standard Backfill

**Endpoint**: `GET /lib/seed/backfill_semantics` (default mode: `learning_units`)

**What it does**:
- Finds every `learning_unit.representative_entry_uuid`
- Reads `mw_entry.raw_json` for each entry
- Rebuilds all semantic tables: `mw_hwi`, `mw_ahw`, `mw_dro`, `mw_uro`, `mw_vr`, `mw_in`, `mw_stem`, `mw_pronunciation`, `mw_sense`, `mw_sense_dt`
- Idempotent (uses `onConflictDoNothing` / `onConflictDoUpdate`)

**Use case**: After schema changes or parsing improvements, reparse all existing entries.

### Repair Stale HWI Anchors

**Endpoint**: `GET /lib/seed/backfill_semantics?mode=repair_stale_hwi`

**What it does**:
- Finds `mw_stem` rows where `anchor_kind = 'HWI'` but `anchor_id IS NULL` or `anchor_id <> entry_uuid`
- Reparses those entries via `backfillEntrySemantics(entry_uuid)`

**Use case**: Fix entries where HWI stems were created before `anchor_id` was properly populated.

### Repair Headword Anchors

**Endpoint**: `GET /lib/seed/backfill_semantics?mode=repair_headword_anchors`

**What it does**:
- Finds entries where a stem matching the headword (normalized) is **not** anchored to `HWI`
- SQL: `SELECT DISTINCT ms.entry_uuid FROM mw_stem ms INNER JOIN mw_hwi mh ON mh.entry_uuid = ms.entry_uuid WHERE ms.stem_norm = lower(replace(mh.hw, '*', '')) AND ms.anchor_kind <> 'HWI'`
- Reparses those entries via `backfillEntrySemantics(entry_uuid)`

**Use case**: Fix entries where headword stems were incorrectly anchored to `VRS`/`INS` instead of `HWI` (e.g., "mercury" → "Mercury" variant instead of HWI).

### Debug Entry

**Endpoint**: `GET /lib/seed/backfill_semantics?mode=debug_entry&metaId=mercury`

**What it returns**:
- Entry UUIDs for that `meta_id`
- All `mw_stem` rows (stem, stem_norm, anchor_kind, anchor_id, fallback_warning)
- All HWI pronunciations for those entries

**Use case**: Diagnose anchoring issues for a specific entry.

---

## Key Architectural Decisions

### Why Polymorphic Pronunciation Owners?

MW stores pronunciations in `prs[]` arrays attached to various semantic objects (HWI, AHW, DRO, URO, variants, inflections). Rather than creating separate pronunciation tables per owner type, we use a single `mw_pronunciation` table with `owner_type` + `owner_id` columns.

**Benefits**:
- Single query pattern: `WHERE owner_type = ? AND owner_id = ?`
- Easy to extend to sense-level owners later
- Consistent audio lookup logic across all owner types

**Trade-off**: `owner_id` is stored as text (not a FK), but this is acceptable because:
- We validate owner existence during ingest/backfill
- The polymorphic nature makes FK constraints impractical

### Why Normalized Definition Tables?

MW's definition structure (`def`, `sseq`, `sense`, `bs`, `pseq`) is deeply nested and complex. Rather than parsing raw JSON in the UI, we normalize it into `mw_sense` and `mw_sense_dt` tables.

**Benefits**:
- UI can query definitions without JSON parsing
- Definitions are replayable (can rebuild from `raw_json` if schema changes)
- Easier to query/filter definitions (e.g., "all DRO definitions")

**Trade-off**: More storage, but definitions are relatively small compared to full `raw_json`.

### Why Stem-Anchored Learning Units?

Every `learning_unit` points to exactly one `mw_stem` row. This ensures:

1. **Traceability**: Every vocabulary item is linked to a MW-asserted searchable term
2. **Pronunciation accuracy**: Stems anchor to semantic owners, which own pronunciations
3. **Morphological flexibility**: Multiple stems (e.g., "Mercury", "mercury") can exist in the same entry, each with its own anchor

**Alternative considered**: Anchor directly to entries. Rejected because:
- Entries can have multiple stems with different pronunciations
- User might want to learn "Mercury" (capitalized) vs. "mercury" (lowercase) separately
- Stems provide finer-grained control over what the user is learning

### Why First-Letter Case Preservation?

When a user searches "Mercury" vs. "mercury", we preserve only the first letter's case in `created_from_lookup_key`. This allows us to:

1. **Match user intent**: Capitalized proper nouns vs. lowercase common nouns
2. **Select correct stem variant**: If `meta.stems[]` contains both "Mercury" and "mercury", we pick the one matching the user's capitalization preference
3. **Display consistent labels**: The `learning_unit.label` matches the selected stem's casing

**Trade-off**: We ignore random internal capitalization (e.g., "mERCURY" → "mercury"), but this is acceptable because MW's `meta.stems[]` doesn't contain such forms.

### Why HWI Anchoring Priority?

When a stem matches the headword (normalized), we anchor it to `HWI` **before** checking `VRS`/`INS`. This ensures:

1. **Pronunciation accuracy**: Headword pronunciations (`hwi.prs[]`) are more reliable than variant/inflection pronunciations
2. **Consistency**: Headword stems should always anchor to the headword, not variants
3. **UI correctness**: Entry titles (derived from headword) get correct audio

**Implementation**: In `resolveStemAnchors()`, we check `hwiHwNorm === k` **first**, before checking `vrByNorm`/`inByNorm`.

---

## File Organization

### Service Layer (`lib/services/`)

- **`mw-client.ts`**: MW API HTTP client
- **`mw-parse.ts`**: Raw MW JSON → `InsertMwEntry[]`
- **`learning-unit-search.ts`**: Search orchestration (DB lookup → MW fetch → persist)

### DAO Layer (`lib/services/dao/`)

- **`learning-unit-dao.ts`**: Core persistence (`upsertLearningUnit`, `fetchLearningUnitsFromLookupKey`)
- **`entry-backfill.ts`**: Backfill semantics from stored `raw_json`
- **`mw-extract.ts`**: Shared extraction helpers (variants, inflections, pronunciations)
- **`stem-morph.ts`**: Morphological fallback rules
- **`mw-def-parse.ts`**: Definition parsing (`def` → `mw_sense` + `mw_sense_dt`)
- **`definitions-dao.ts`**: Definition table persistence
- **`learning-unit-summaries.ts`**: Common queries (library list, search)
- **`mw-pronunciation.ts`**: Pronunciation queries
- **`user-vocab.ts`**: User progress queries

### Actions (`lib/actions/`)

- **`library.ts`**: Library list + word detail queries (`getUserLibraryUnits`, `getWordDetail`)
- **`search-widget.ts`**: Search widget queries (`searchExistingUnits`, `searchAndResolve`)

### Components (`components/`)

- **`pronunciation-button.tsx`**: Audio playback component (constructs MW CDN URLs)
- **`library-unit-card.tsx`**: Library list item card
- **`library-search.tsx`**: Search widget UI

### Pages (`app/dashboard/library/`)

- **`(overview)/page.tsx`**: Library list page
- **`words/[id]/page.tsx`**: Word detail page (full entry group rendering)

### Seed Routes (`app/lib/seed/`)

- **`add_words/route.ts`**: Add words to database (for testing)
- **`add_userVocab/route.ts`**: Populate user vocabulary (for testing)
- **`backfill_semantics/route.ts`**: Backfill/repair endpoints

---

## Common Tasks

### Add a New Word

1. Call `GET /lib/seed/add_words?words=mercury,tenacious`
2. System fetches from MW API, persists entries, creates learning units
3. Check `learning_unit` table for new rows

### Populate User Vocabulary

1. Call `GET /lib/seed/add_userVocab?userId=<uuid>&reset=1`
2. System adds all `learning_unit` rows to `user_vocab` with random progress
3. At least 3 words will have `progress = 0` (new words)

### Repair Anchoring Issues

1. **Debug**: `GET /lib/seed/backfill_semantics?mode=debug_entry&metaId=mercury`
2. **Repair**: `GET /lib/seed/backfill_semantics?mode=repair_headword_anchors`
3. **Verify**: Re-check the entry in the UI

### Add a New Morphological Rule

1. Edit `lib/services/dao/stem-morph.ts` → `morphBaseCandidates()`
2. Add your rule (e.g., `...ism → ...ist` for "precisionism" → "precisionist")
3. Test with a word that triggers the rule
4. Run backfill to apply to existing data: `GET /lib/seed/backfill_semantics`

---

## Important Invariants

1. **Every `learning_unit.stem_id` must reference a valid `mw_stem.stem_id`**
2. **Every `mw_stem.entry_uuid` must reference a valid `mw_entry.entry_uuid`**
3. **Every `mw_stem.anchor_id` (when not NULL) must reference a valid owner row**:
   - `HWI`: `anchor_id = entry_uuid` (exists in `mw_entry`)
   - `AHW`: `anchor_id = ahw_id` (exists in `mw_ahw`)
   - `DRO`: `anchor_id = dro_id` (exists in `mw_dro`)
   - `URO`: `anchor_id = uro_id` (exists in `mw_uro`)
   - `VRS`: `anchor_id = vr_id` (exists in `mw_vr`)
   - `INS`: `anchor_id = in_id` (exists in `mw_in`)
4. **Every `mw_pronunciation.owner_id` must reference a valid owner row** (same mapping as above)
5. **Every `mw_sense.scope_id` must reference a valid scope**:
   - `ENTRY`: `scope_id = entry_uuid` (exists in `mw_entry`)
   - `DRO`: `scope_id = dro_id` (exists in `mw_dro`)
6. **Entry titles must match headword capitalization exactly** (if `hwi.hw` is "mercury", title is "mercury", not "Mercury")

---

## Future Work

- **Sense-level anchoring**: Anchor stems to sense-level structures (e.g., sense-specific variants)
- **Cross-reference modeling**: Persist `cxt` entries as owners
- **Phrase-level owners**: Model `<phrase>` structures as owners
- **Definition link targets**: Persist `<a>` link targets as owners
- **Multi-language support**: Extend pronunciation system to handle multiple languages explicitly
