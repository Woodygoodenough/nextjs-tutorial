import {
    pgTable,
    uuid,
    text,
    jsonb,
    timestamp,
    date,
    integer,
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

  // 3) Pronunciations: can belong to entry-level OR a specific dro
export const mwPronunciation = pgTable(
    "mw_pronunciation",
    {
        pronunciationId: uuid("pronunciation_id").defaultRandom().primaryKey(),

        entryUuid: uuid("entry_uuid")
        .notNull()
        .references(() => mwEntry.entryUuid, { onDelete: "cascade" }),

        /** null => entry-level (hwi.prs or similar); non-null => dro-level (dros[].prs) */
        droId: uuid("dro_id").references(() => mwDro.droId, { onDelete: "cascade" }),

        /** prs[].mw (written pronunciation in MW format), if present */
        mw: text("mw"),

        /** prs[].l / prs[].l2 / prs[].pun (optional) */
        l: text("l"),
        l2: text("l2"),
        pun: text("pun"),

        /**
         * prs[].sound.audio base filename for audio playback, if present.
         * (ref/stat can be ignored per MW docs)
         */
        audioBase: text("audio_base"),

        /**
         * Needed to reconstruct URL:
         * https://media.merriam-webster.com/audio/prons/[lang]/[country]/[format]/[subdir]/[audioBase].[format]
         */
        langCode: text("lang_code").notNull(),    // e.g. "en"
        countryCode: text("country_code").notNull(), // e.g. "us"

        /** preserves ordering within prs[] list */
        rank: integer("rank").notNull(),

        fetchedAt: timestamp("fetched_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
        // within a (entry, dro or entry-level), rank identifies pronunciation order
        uniqueIndex("mw_pron_entry_dro_rank_unique").on(t.entryUuid, t.droId, t.rank),

        index("mw_pron_entry_idx").on(t.entryUuid),
        index("mw_pron_dro_idx").on(t.droId),
        index("mw_pron_audio_base_idx").on(t.audioBase),
    ],
);


export type InsertMwDro = InferInsertModel<typeof mwDro>;
export type SelectMwDro = InferSelectModel<typeof mwDro>;

export type InsertMwUro = InferInsertModel<typeof mwUro>;
export type SelectMwUro = InferSelectModel<typeof mwUro>;
  
export type InsertMwPronunciation = InferInsertModel<typeof mwPronunciation>;
export type SelectMwPronunciation = InferSelectModel<typeof mwPronunciation>;

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