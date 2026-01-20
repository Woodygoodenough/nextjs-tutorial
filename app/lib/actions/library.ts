"use server";

import { auth } from "@/auth";
import { db, sql } from "@/app/lib/db/client";
import { users, learningUnit, userVocab, lookupKey, mwEntry } from "@/app/lib/db/schema";
import { eq, and, or, ilike, count, desc } from "drizzle-orm";

export type LibraryUnit = {
  unitId: string;
  label: string;
  matchMethod: string;
  progress: number;
  lastReviewedAt: Date | null;
  shortdef: string | null;
};

export type LibraryPageResult = {
  units: LibraryUnit[];
  total: number;
  page: number;
  totalPages: number;
};

export type WordDetail = {
  unitId: string;
  label: string;
  matchMethod: string;
  progress: number;
  lastReviewedAt: Date | null;
  shortdef: string | null;
  headwordRaw: string | null;
  metaId: string | null;
};

async function requireUserId(): Promise<string> {
  const session = await auth();
  const sessionUser = session?.user as { id?: string; email?: string } | undefined;

  if (sessionUser?.id) return sessionUser.id;
  if (sessionUser?.email) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, sessionUser.email))
      .limit(1);
    const id = rows[0]?.id;
    if (id) return id;
  }
  throw new Error("Not authenticated");
}

export async function getUserLibraryUnits(
  searchQuery: string = "",
  page: number = 1,
  pageSize: number = 10
): Promise<LibraryPageResult> {
  const userId = await requireUserId();
  const offset = (page - 1) * pageSize;
  const searchTerm = searchQuery.trim();

  // Use SQL for complex query with joins and search
  if (searchTerm) {
    const countRows = await sql<Array<{ total: number }>>`
      SELECT COUNT(DISTINCT uv.unit_id)::int as total
      FROM user_vocab uv
      INNER JOIN learning_unit lu ON uv.unit_id = lu.unit_id
      LEFT JOIN lookup_key lk ON lu.unit_id = lk.unit_id
      WHERE uv.user_id = ${userId}
        AND (lu.label ILIKE ${`%${searchTerm}%`} OR lk.lookup_key ILIKE ${`%${searchTerm}%`})
    `;

    const unitsRows = await sql<Array<{
      unit_id: string;
      label: string;
      match_method: string;
      progress: number;
      last_reviewed_at: Date | null;
      shortdef: string | null;
    }>>`
      SELECT DISTINCT
        lu.unit_id as unit_id,
        lu.label as label,
        lu.match_method as match_method,
        uv.progress as progress,
        uv.last_reviewed_at as last_reviewed_at,
        CASE 
          WHEN me.raw_json IS NOT NULL THEN
            COALESCE(
              (me.raw_json->'def'->0->'sseq'->0->0->1->'dt'->0->1)::text,
              (me.raw_json->'def'->0->'sseq'->0->0->1->'dt'->0->0->1)::text,
              NULL
            )
          ELSE NULL
        END as shortdef
      FROM user_vocab uv
      INNER JOIN learning_unit lu ON uv.unit_id = lu.unit_id
      LEFT JOIN lookup_key lk ON lu.unit_id = lk.unit_id
      LEFT JOIN mw_entry me ON lu.representative_entry_uuid = me.entry_uuid
      WHERE uv.user_id = ${userId}
        AND (lu.label ILIKE ${`%${searchTerm}%`} OR lk.lookup_key ILIKE ${`%${searchTerm}%`})
      ORDER BY uv.last_reviewed_at DESC NULLS LAST, lu.created_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;

    const total = Number(countRows[0]?.total ?? 0);
    const totalPages = Math.ceil(total / pageSize);

    return {
      units: unitsRows.map((u) => {
        // Clean up shortdef: remove quotes, escape sequences, and HTML-like tags
        let shortdef = u.shortdef;
        if (shortdef) {
          shortdef = shortdef.replace(/^"|"$/g, '').replace(/\\"/g, '"').replace(/\\n/g, ' ');
          // Remove common MW API formatting
          shortdef = shortdef.replace(/\[.*?\]/g, '').replace(/\{.*?\}/g, '').trim();
          // Limit length
          if (shortdef.length > 150) {
            shortdef = shortdef.substring(0, 147) + '...';
          }
        }
        return {
          unitId: u.unit_id,
          label: u.label,
          matchMethod: u.match_method,
          progress: u.progress,
          lastReviewedAt: u.last_reviewed_at,
          shortdef: shortdef || null,
        };
      }),
      total,
      page,
      totalPages,
    };
  } else {
    // No search - simpler query
    const countResult = await db
      .select({ total: count() })
      .from(userVocab)
      .where(eq(userVocab.userId, userId));

    const total = Number(countResult[0]?.total ?? 0);
    const totalPages = Math.ceil(total / pageSize);

    // Fetch with progress, lastReviewedAt, and shortdef
    const unitsRows = await sql<Array<{
      unit_id: string;
      label: string;
      match_method: string;
      progress: number;
      last_reviewed_at: Date | null;
      shortdef: string | null;
    }>>`
      SELECT
        lu.unit_id as unit_id,
        lu.label as label,
        lu.match_method as match_method,
        uv.progress as progress,
        uv.last_reviewed_at as last_reviewed_at,
        CASE 
          WHEN me.raw_json IS NOT NULL THEN
            COALESCE(
              (me.raw_json->'def'->0->'sseq'->0->0->1->'dt'->0->1)::text,
              (me.raw_json->'def'->0->'sseq'->0->0->1->'dt'->0->0->1)::text,
              NULL
            )
          ELSE NULL
        END as shortdef
      FROM user_vocab uv
      INNER JOIN learning_unit lu ON uv.unit_id = lu.unit_id
      LEFT JOIN mw_entry me ON lu.representative_entry_uuid = me.entry_uuid
      WHERE uv.user_id = ${userId}
      ORDER BY uv.last_reviewed_at DESC NULLS LAST, lu.created_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;

    return {
      units: unitsRows.map((u) => {
        // Clean up shortdef: remove quotes, escape sequences, and HTML-like tags
        let shortdef = u.shortdef;
        if (shortdef) {
          shortdef = shortdef.replace(/^"|"$/g, '').replace(/\\"/g, '"').replace(/\\n/g, ' ');
          // Remove common MW API formatting
          shortdef = shortdef.replace(/\[.*?\]/g, '').replace(/\{.*?\}/g, '').trim();
          // Limit length
          if (shortdef.length > 150) {
            shortdef = shortdef.substring(0, 147) + '...';
          }
        }
        return {
          unitId: u.unit_id,
          label: u.label,
          matchMethod: u.match_method,
          progress: u.progress,
          lastReviewedAt: u.last_reviewed_at,
          shortdef: shortdef || null,
        };
      }),
      total,
      page,
      totalPages,
    };
  }
}

export async function getWordDetail(unitId: string): Promise<WordDetail | null> {
  const userId = await requireUserId();

  const rows = await sql<Array<{
    unit_id: string;
    label: string;
    match_method: string;
    progress: number;
    last_reviewed_at: Date | null;
    shortdef: string | null;
    headword_raw: string | null;
    meta_id: string | null;
  }>>`
    SELECT
      lu.unit_id as unit_id,
      lu.label as label,
      lu.match_method as match_method,
      uv.progress as progress,
      uv.last_reviewed_at as last_reviewed_at,
      CASE 
        WHEN me.raw_json IS NOT NULL THEN
          COALESCE(
            (me.raw_json->'def'->0->'sseq'->0->0->1->'dt'->0->1)::text,
            (me.raw_json->'def'->0->'sseq'->0->0->1->'dt'->0->0->1)::text,
            NULL
          )
        ELSE NULL
      END as shortdef,
      me.headword_raw as headword_raw,
      me.meta_id as meta_id
    FROM user_vocab uv
    INNER JOIN learning_unit lu ON uv.unit_id = lu.unit_id
    LEFT JOIN mw_entry me ON lu.representative_entry_uuid = me.entry_uuid
    WHERE uv.user_id = ${userId} AND lu.unit_id = ${unitId}
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const u = rows[0];
  
  // Clean up shortdef
  let shortdef = u.shortdef;
  if (shortdef) {
    shortdef = shortdef.replace(/^"|"$/g, '').replace(/\\"/g, '"').replace(/\\n/g, ' ');
    shortdef = shortdef.replace(/\[.*?\]/g, '').replace(/\{.*?\}/g, '').trim();
  }

  return {
    unitId: u.unit_id,
    label: u.label,
    matchMethod: u.match_method,
    progress: u.progress,
    lastReviewedAt: u.last_reviewed_at,
    shortdef: shortdef || null,
    headwordRaw: u.headword_raw,
    metaId: u.meta_id,
  };
}
