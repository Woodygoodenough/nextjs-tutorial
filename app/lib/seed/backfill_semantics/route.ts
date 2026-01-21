import { backfillSemanticsForLearningUnits } from "@/lib/services/dao/backfill-entry";

export async function GET() {
  try {
    const r = await backfillSemanticsForLearningUnits();
    return Response.json({ ok: true, ...r });
  } catch (e) {
    const err = e as any;
    const message = err instanceof Error ? err.message : String(err);
    const cause = err?.cause?.message ?? err?.cause?.toString?.();
    return Response.json(
      { ok: false, error: message, cause: cause ?? null },
      { status: 500 },
    );
  }
}

