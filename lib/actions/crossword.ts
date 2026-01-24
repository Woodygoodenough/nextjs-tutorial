"use server";

import { sql } from "@/lib/db/client";

export async function getRandomWords(count: number = 10): Promise<{ word: string; clue: string }[]> {
  // Select random learning units
  // For clues, we'll try to use definitions.
  // Since fetching definitions involves complex joins (mw_sense, mw_sense_dt),
  // for this MVP random generator, we might just use the headword or fetch a simple definition.

  // Efficient random sampling in SQL is hard (ORDER BY RANDOM() is slow on large tables),
  // but for a vocab app (likely <100k words), it's fine.

  // Use postgres client directly (sql`...`) instead of db.execute(sql`...`)
  // because `sql` here is the postgres client, not drizzle's sql template tag.
  const result = await sql`
    SELECT
      lu.label as word,
      (
        SELECT d.text
        FROM mw_sense s
        JOIN mw_sense_dt d ON d.sense_id = s.sense_id
        WHERE s.entry_uuid = lu.representative_entry_uuid
          AND d.dt_type = 'text'
        LIMIT 1
      ) as clue
    FROM learning_unit lu
    ORDER BY RANDOM()
    LIMIT ${count}
  `;

  // Map result (postgres.js returns array of row objects)
  // Ensure we have a clue. If not, use a fallback.
  return result.map((row: any) => ({
    word: row.word,
    clue: row.clue || "No definition available"
  }));
}
