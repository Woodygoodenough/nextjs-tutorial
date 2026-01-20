-- Rename column to match schema: mastery -> recent_mastery
ALTER TABLE "user_vocab" RENAME COLUMN "mastery" TO "recent_mastery";