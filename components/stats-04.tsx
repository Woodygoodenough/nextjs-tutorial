import { getReviewDue, getUserAverageProgress, getUserTotalVocab } from "@/app/lib/data/summary";
import { db } from "@/app/lib/db/client";
import { users } from "@/app/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";

export default async function Stats04() {
  const session = await auth();
  const sessionUser = session?.user as { id?: string; email?: string } | undefined;

  // Sessions may not always include `user.id`, so fall back to lookup by email.
  let userId = sessionUser?.id ?? null;
  if (!userId && sessionUser?.email) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, sessionUser.email))
      .limit(1);
    userId = rows[0]?.id ?? null;
  }

  const totalVocab = userId ? await getUserTotalVocab(userId) : 0;
  const avgProgress = userId ? await getUserAverageProgress(userId) : 0;
  const userVocabReviewDue = userId ? await getReviewDue(userId) : [];

  type StatItem = {
    name: string;
    stat: string;
    change?: string;
    changeType?: "positive" | "negative";
  };

  const data: Array<StatItem> = [
    {
      name: "Total Vocab",
      stat: totalVocab.toLocaleString(),
      change: "+12.1%",
      changeType: "positive" as const,
    },
    {
      name: "Avg progress",
      stat: `${Math.round(avgProgress)}%`,
      change: "+3.4%",
      changeType: "positive" as const,
    },
    {
      name: "Vocab Due!",
      stat: userVocabReviewDue.length.toLocaleString(),
    },
  ];

  return (
    <div className="flex items-center justify-center p-10 w-full">
      <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 w-full">
        {data.map((item) => (
          <Card key={item.name} className="p-6 py-4 w-full">
            <CardContent className="p-0">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground">
                  {item.name}
                </dt>
                {item.changeType ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-medium inline-flex items-center px-1.5 ps-2.5 py-0.5 text-xs",
                      item.changeType === "positive"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    )}
                  >
                    {item.changeType === "positive" ? (
                      <TrendingUp className="mr-0.5 -ml-1 h-5 w-5 shrink-0 self-center text-green-500" />
                    ) : (
                      <TrendingDown className="mr-0.5 -ml-1 h-5 w-5 shrink-0 self-center text-red-500" />
                    )}
                    <span className="sr-only">
                      {item.changeType === "positive" ? "Increased" : "Decreased"} by{" "}
                    </span>
                    {item.change ?? "—"}
                  </Badge>
                ) : null}
              </div>
              <dd className="text-3xl font-semibold text-foreground mt-2">
                {item.stat}
              </dd>
            </CardContent>
          </Card>
        ))}
      </dl>
    </div>
  );
}
