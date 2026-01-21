import "server-only";

import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function requireUserId(): Promise<string> {
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

