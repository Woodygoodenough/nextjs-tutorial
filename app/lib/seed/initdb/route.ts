import bcrypt from 'bcrypt';
import { NextResponse } from 'next/server';
import postgres from 'postgres';
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "path";

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });


/**
 * Minimal schema bootstrap endpoint (V1 plan).
 * NOTE: Pass `?reset=1` to drop and recreate tables (early-stage reset).
 */
export async function GET(request: Request) {
  if (!process.env.POSTGRES_URL) {
    return NextResponse.json(
      { ok: false, error: "Missing POSTGRES_URL. Set it in .env.local (dev) or Vercel env vars (prod)." },
      { status: 500 },
    );
  }

  try {
    const url = new URL(request.url);
    const reset = url.searchParams.get("reset") === "1" || url.searchParams.get("reset") === "true";

    if (reset) {
      // Wipe everything in the `public` schema: tables, views, types, indexes, etc.
      // This is the closest thing to "drop everything" without dropping the database itself.
      await sql`drop schema if exists public cascade;`;
      await sql`create schema public;`;
    }

    // Needed for `uuid().defaultRandom()` (gen_random_uuid()) used by the Drizzle schema.
    await sql`create extension if not exists "pgcrypto";`;

    // Run Drizzle migrations generated from `app/lib/db/schema.ts`.
    // This is the ORM-driven way to create/update tables.
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

    const users = [
      {
        id: '410544b2-4001-4271-9855-fec4b6a6442a',
        name: 'Valuable Student',
        email: 'valuable@student.com',
        password: '123456',
      },
    ];
    // Insert users
    await Promise.all(
      users.map(async (user) => {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        return sql`
            INSERT INTO users (id, name, email, password)
            VALUES (${user.id}, ${user.name}, ${user.email}, ${hashedPassword})
            ON CONFLICT (email) DO NOTHING;
          `;
      }),
    );
    const check = await sql`select 1 as ok, now() as now;`;

    return NextResponse.json({
      ok: true,
      db: "connected",
      schema: "ready",
      reset,
      check,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        db: "error",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

