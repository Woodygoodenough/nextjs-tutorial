import { eq } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/app/lib/db/client"
import { users } from "@/app/lib/db/schema"
import { getRecentProgressRecords } from "@/app/lib/data/summary"
import { ChartLineLabelClient } from "@/components/chart-line-label-client"

export async function ChartLineLabel() {
    const session = await auth()
    const sessionUser = session?.user as { id?: string; email?: string } | undefined

    let userId = sessionUser?.id ?? null
    if (!userId && sessionUser?.email) {
        const rows = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, sessionUser.email))
            .limit(1)
        userId = rows[0]?.id ?? null
    }

    const latest = userId ? await getRecentProgressRecords(userId, 7) : []
    const chronological = [...latest].reverse()

    const data = chronological.map((r) => {
        const rawDate: any = (r as any).date
        const day =
            typeof rawDate === "string"
                ? rawDate
                : rawDate?.toISOString?.().slice(0, 10) ?? ""
        return {
            day,
            avg: Number(r.averageProgress ?? 0),
            vocab: Number(r.vocabCount ?? 0),
        }
    })

    return <ChartLineLabelClient data={data} />
}
