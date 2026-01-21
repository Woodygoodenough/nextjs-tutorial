import {
    pgTable,
    uuid,
    text,
    jsonb,
    timestamp,
    date,
    integer,
    boolean,
    primaryKey,
    uniqueIndex,
    index,
} from "drizzle-orm/pg-core";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const users = pgTable(
    "users",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        name: text("name").notNull(),
        email: text("email").notNull(),
        password: text("password").notNull(),
    },
    (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export const mwEntry = pgTable("mw_entry", {
    entryUuid: uuid("entry_uuid").primaryKey(),
    metaId: text("meta_id"),
    headwordRaw: text("headword_raw"),
    stems: jsonb("stems"), // could also be: text("stems").array() if you prefer text[]
    rawJson: jsonb("raw_json").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

// Headword info (hwi) (1 row per entry)
export const mwHwi = pgTable("mw_hwi", {
    entryUuid: uuid("entry_uuid")
        .primaryKey()
        .references(() => mwEntry.entryUuid, { onDelete: "cascade" }),
    hw: text("hw").notNull(),
});

// Alternate headwords (ahws) (0..n per entry)
export const mwAhw = pgTable(
    "mw_ahw",
    {
        ahwId: uuid("ahw_id").defaultRandom().primaryKey(),
        entryUuid: uuid("entry_uuid")
            .notNull()
            .references(() => mwEntry.entryUuid, { onDelete: "cascade" }),
        hw: text("hw").notNull(),
        rank: integer("rank").notNull(),
    },
    (t) => [
        uniqueIndex("mw_ahw_entry_rank_unique").on(t.entryUuid, t.rank),
        index("mw_ahw_entry_idx").on(t.entryUuid),
        index("mw_ahw_hw_idx").on(t.hw),
    ],
);

// Searchable stems (meta.stems) (1 row per stems[] item)
export const mwStem = pgTable(
    "mw_stem",
    {
        stemId: uuid("stem_id").defaultRandom().primaryKey(),
        entryUuid: uuid("entry_uuid")
            .notNull()
            .references(() => mwEntry.entryUuid, { onDelete: "cascade" }),
        stem: text("stem").notNull(),
        stemNorm: text("stem_norm").notNull(),
        anchorKind: text("anchor_kind").notNull(), // HWI | AHW | DRO | URO | VRS | INS | UNKNOWN
        anchorId: text("anchor_id"), // polymorphic reference (uuid as text or path token)
        fallbackWarning: boolean("fallback_warning").notNull().default(false),
        rank: integer("rank").notNull(),
        fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        uniqueIndex("mw_stem_entry_rank_unique").on(t.entryUuid, t.rank),
        index("mw_stem_norm_idx").on(t.stemNorm),
        index("mw_stem_entry_idx").on(t.entryUuid),
    ],
);

export const lexicalGroup = pgTable(
    "lexical_group",
    {
        groupId: uuid("group_id").primaryKey(),
        fingerprint: text("fingerprint").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
    },
    (t) => [uniqueIndex("lexical_group_fingerprint_unique").on(t.fingerprint)],
);

export const lexicalGroupEntry = pgTable(
    "lexical_group_entry",
    {
        groupId: uuid("group_id")
            .notNull()
            .references(() => lexicalGroup.groupId, { onDelete: "cascade" }),
        entryUuid: uuid("entry_uuid")
            .notNull()
            .references(() => mwEntry.entryUuid, { onDelete: "cascade" }),
        rank: integer("rank").notNull(),
    },
    (t) => [primaryKey({ columns: [t.groupId, t.entryUuid] })],
);

export const learningUnit = pgTable(
    "learning_unit",
    {
        unitId: uuid("unit_id").primaryKey(),
        label: text("label").notNull(),
        stemId: uuid("stem_id")
            .notNull()
            .references(() => mwStem.stemId, { onDelete: "restrict" }),
        groupId: uuid("group_id")
            .notNull()
            .references(() => lexicalGroup.groupId, { onDelete: "cascade" }),
        representativeEntryUuid: uuid("representative_entry_uuid")
            .notNull()
            .references(() => mwEntry.entryUuid),
        matchMethod: text("match_method").notNull(), // you can enforce via enum too
        createdFromLookupKey: text("created_from_lookup_key").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [uniqueIndex("learning_unit_group_label_unique").on(t.groupId, t.label)],
);

export const lookupKey = pgTable("lookup_key", {
    lookupKey: text("lookup_key").primaryKey(),
    unitId: uuid("unit_id")
        .notNull()
        .references(() => learningUnit.unitId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    hitCount: integer("hit_count").notNull().default(1),
});

export const userVocab = pgTable(
    "user_vocab",
    {
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        unitId: uuid("unit_id")
            .notNull()
            .references(() => learningUnit.unitId, { onDelete: "cascade" }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }).notNull().defaultNow(),
        nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
        // Review scheduler state
        progress: integer("progress").notNull().default(0),
        /** 0 | 1 | null (stored as int). Mastery result of the most recent review. */
        recentMastery: integer("recent_mastery"),
    },
    (t) => [
        primaryKey({ columns: [t.userId, t.unitId] }),
        index("user_vocab_user_last_reviewed_idx").on(t.userId, t.lastReviewedAt),
        index("user_vocab_user_next_review_idx").on(t.userId, t.nextReviewAt),
    ],
);

export const userProgressRecord = pgTable(
    "user_progress_record",
    {
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        date: date("date").notNull(),
        vocabCount: integer("vocab_count").notNull(),
        averageProgress: integer("average_progress").notNull(),
    },
    (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

// within entry table
export const mwDro = pgTable(
    "mw_dro",
    {
      droId: uuid("dro_id").primaryKey(),
  
      entryUuid: uuid("entry_uuid")
        .notNull()
        .references(() => mwEntry.entryUuid, { onDelete: "cascade" }),
  
      /** dros[].drp (defined run-on phrase) */
      drp: text("drp").notNull(),
  
      /** preserves MW ordering inside dros[] */
      rank: integer("rank").notNull(),
  
      /** dros[].def (required by MW docs); store as-is for now */
      def: jsonb("def").notNull(),
  
      fetchedAt: timestamp("fetched_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      // One entry can have multiple dros; rank is stable within that entry fetch
      uniqueIndex("mw_dro_entry_rank_unique").on(t.entryUuid, t.rank),
      index("mw_dro_entry_idx").on(t.entryUuid),
      index("mw_dro_drp_idx").on(t.drp),
    ],
  );
  
  // 2) Undefined Run-Ons (UROs): undefined entry words derived from headword
export const mwUro = pgTable(
    "mw_uro",
    {
        uroId: uuid("uro_id").primaryKey(),

        entryUuid: uuid("entry_uuid")
            .notNull()
            .references(() => mwEntry.entryUuid, { onDelete: "cascade" }),

        /** uros[].ure (undefined entry word) */
        ure: text("ure").notNull(),

        /** uros[].fl (functional label) - required */
        fl: text("fl").notNull(),

        /** preserves MW ordering inside uros[] */
        rank: integer("rank").notNull(),

        /** uros[].utxt (undefined run-on text section) - optional, stored as JSONB for future use */
        utxt: jsonb("utxt"),

        /** Other optional fields: ins, lbs, prs, psl, sls, vrs - stored as JSONB for future use */
        rawJson: jsonb("raw_json"),

        fetchedAt: timestamp("fetched_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (t) => [
        // One entry can have multiple uros; rank is stable within that entry fetch
        uniqueIndex("mw_uro_entry_rank_unique").on(t.entryUuid, t.rank),
        index("mw_uro_entry_idx").on(t.entryUuid),
        index("mw_uro_ure_idx").on(t.ure),
    ],
);

// Variants (vrs) - can occur in many places
export const mwVr = pgTable(
    "mw_vr",
    {
        vrId: uuid("vr_id").defaultRandom().primaryKey(),
        entryUuid: uuid("entry_uuid")
            .notNull()
            .references(() => mwEntry.entryUuid, { onDelete: "cascade" }),
        va: text("va").notNull(),
        vl: text("vl"),
        rank: integer("rank").notNull(),
        scopeType: text("scope_type").notNull(), // ENTRY | DRO | URO | ...
        scopeRef: text("scope_ref"), // JSONPath-ish string (until we model sense tables)
        fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        index("mw_vr_entry_idx").on(t.entryUuid),
        index("mw_vr_va_idx").on(t.va),
        index("mw_vr_scope_idx").on(t.scopeType, t.scopeRef),
    ],
);

// Inflections (ins) - can occur in many places
export const mwIn = pgTable(
    "mw_in",
    {
        inId: uuid("in_id").defaultRandom().primaryKey(),
        entryUuid: uuid("entry_uuid")
            .notNull()
            .references(() => mwEntry.entryUuid, { onDelete: "cascade" }),
        inflection: text("if"), // ins[].if
        ifc: text("ifc"), // ins[].ifc
        il: text("il"), // ins[].il
        rank: integer("rank").notNull(),
        scopeType: text("scope_type").notNull(),
        scopeRef: text("scope_ref"),
        fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        index("mw_in_entry_idx").on(t.entryUuid),
        index("mw_in_if_idx").on(t.inflection),
        index("mw_in_ifc_idx").on(t.ifc),
        index("mw_in_scope_idx").on(t.scopeType, t.scopeRef),
    ],
);

// Pronunciations (prs) - polymorphic owner model
export const mwPronunciation = pgTable(
    "mw_pronunciation",
    {
        prId: uuid("pr_id").defaultRandom().primaryKey(),
        entryUuid: uuid("entry_uuid")
            .notNull()
            .references(() => mwEntry.entryUuid, { onDelete: "cascade" }),

        ownerType: text("owner_type").notNull(), // HWI | AHW | DRO | URO | VRS | INS | ...
        ownerId: text("owner_id").notNull(), // uuid as text, or path token for sense-level

        mw: text("mw"),
        pun: text("pun"),
        l: text("l"),
        l2: text("l2"),

        soundAudio: text("sound_audio"),
        soundRef: text("sound_ref"),
        soundStat: text("sound_stat"),

        rank: integer("rank").notNull(),
        fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        uniqueIndex("mw_pron_owner_rank_unique").on(t.ownerType, t.ownerId, t.rank),
        index("mw_pron_owner_idx").on(t.ownerType, t.ownerId),
        index("mw_pron_entry_idx").on(t.entryUuid),
        index("mw_pron_sound_audio_idx").on(t.soundAudio),
    ],
);


export type InsertMwDro = InferInsertModel<typeof mwDro>;
export type SelectMwDro = InferSelectModel<typeof mwDro>;

export type InsertMwUro = InferInsertModel<typeof mwUro>;
export type SelectMwUro = InferSelectModel<typeof mwUro>;
  
export type InsertMwPronunciation = InferInsertModel<typeof mwPronunciation>;
export type SelectMwPronunciation = InferSelectModel<typeof mwPronunciation>;

export type InsertMwStem = InferInsertModel<typeof mwStem>;
export type SelectMwStem = InferSelectModel<typeof mwStem>;

export type InsertMwHwi = InferInsertModel<typeof mwHwi>;
export type SelectMwHwi = InferSelectModel<typeof mwHwi>;

export type InsertMwAhw = InferInsertModel<typeof mwAhw>;
export type SelectMwAhw = InferSelectModel<typeof mwAhw>;

export type InsertMwVr = InferInsertModel<typeof mwVr>;
export type SelectMwVr = InferSelectModel<typeof mwVr>;

export type InsertMwIn = InferInsertModel<typeof mwIn>;
export type SelectMwIn = InferSelectModel<typeof mwIn>;

export type InsertMwEntry = InferInsertModel<typeof mwEntry>;
export type InsertLexicalGroup = InferInsertModel<typeof lexicalGroup>;
export type InsertLexicalGroupEntry = InferInsertModel<typeof lexicalGroupEntry>;
export type InsertLearningUnit = InferInsertModel<typeof learningUnit>;
export type InsertLookupKey = InferInsertModel<typeof lookupKey>;
export type InsertUser = InferInsertModel<typeof users>;
export type InsertUserVocab = InferInsertModel<typeof userVocab>;
export type InsertUserProgressRecord = InferInsertModel<typeof userProgressRecord>;

export type SelectUser = InferSelectModel<typeof users>;
export type SelectMwEntry = InferSelectModel<typeof mwEntry>;
export type SelectLexicalGroup = InferSelectModel<typeof lexicalGroup>;
export type SelectLexicalGroupEntry = InferSelectModel<typeof lexicalGroupEntry>;
export type SelectLearningUnit = InferSelectModel<typeof learningUnit>;
export type SelectLookupKey = InferSelectModel<typeof lookupKey>;
export type SelectUserVocab = InferSelectModel<typeof userVocab>;
export type SelectUserProgressRecord = InferSelectModel<typeof userProgressRecord>;

