"use server";

import { auth } from "@/auth";
import { db, sql } from "@/app/lib/db/client";
import { users, learningUnit, userVocab, lookupKey } from "@/app/lib/db/schema";
import { eq, and, or, ilike, count, desc } from "drizzle-orm";

export type LibraryUnit = {
  unitId: string;
  label: string;
  matchMethod: string;
  createdAt: Date;
};

export type LibraryPageResult = {
  units: LibraryUnit[];
  total: number;
  page: number;
  totalPages: number;
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
      created_at: Date;
    }>>`
      SELECT DISTINCT
        lu.unit_id as unit_id,
        lu.label as label,
        lu.match_method as match_method,
        lu.created_at as created_at
      FROM user_vocab uv
      INNER JOIN learning_unit lu ON uv.unit_id = lu.unit_id
      LEFT JOIN lookup_key lk ON lu.unit_id = lk.unit_id
      WHERE uv.user_id = ${userId}
        AND (lu.label ILIKE ${`%${searchTerm}%`} OR lk.lookup_key ILIKE ${`%${searchTerm}%`})
      ORDER BY lu.created_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;

    const total = Number(countRows[0]?.total ?? 0);
    const totalPages = Math.ceil(total / pageSize);

    return {
      units: unitsRows.map((u) => ({
        unitId: u.unit_id,
        label: u.label,
        matchMethod: u.match_method,
        createdAt: u.created_at,
      })),
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

    const units = await db
      .select({
        unitId: learningUnit.unitId,
        label: learningUnit.label,
        matchMethod: learningUnit.matchMethod,
        createdAt: learningUnit.createdAt,
      })
      .from(userVocab)
      .innerJoin(learningUnit, eq(userVocab.unitId, learningUnit.unitId))
      .where(eq(userVocab.userId, userId))
      .orderBy(desc(learningUnit.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      units: units.map((u) => ({
        unitId: u.unitId,
        label: u.label,
        matchMethod: u.matchMethod,
        createdAt: u.createdAt,
      })),
      total,
      page,
      totalPages,
    };
  }
}
