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