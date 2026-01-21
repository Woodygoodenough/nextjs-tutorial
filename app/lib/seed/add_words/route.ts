import { searchMW } from "@/lib/services/search";
import { silentlyPersistLookupKey, persistSearchResult } from "@/lib/services/search";
import { GetUnitResult } from "@/lib/types/commons";

async function resolveSearchAndPersist(lookupKey: string): Promise<GetUnitResult> {
    const result = await searchMW(lookupKey);
    // Persisting lookup keys is currently best-effort; persistence of new units is handled below.
    await silentlyPersistLookupKey(result);
    await persistSearchResult(result);
    return result;
}
export async function GET() {
    const words = [
        "context",
        "serendipity",
        "diligent",
        "resilience",
        "curiosity",
        "insight",
        "nuance",
        "empathy",
        "eloquent",
        "candid",
        "tenacious",
        "meticulous",
        "ambiguous",
        "pragmatic",
        "paradox",
        "ephemeral",
        "ubiquitous",
        "quintessential",
        "innovation",
        "algorithm",
        "database",
        "synthesis",
        "hypothesis",
        "anomaly",
        "spectrum",
        "catalyst",
        "equilibrium",
    ];

    const results: Array<{ word: string; ok: boolean; status?: string; error?: string }> = [];
    for (const word of words) {
        try {
            const r = await resolveSearchAndPersist(word);
            results.push({ word, ok: true, status: r.status });
        } catch (e) {
            results.push({ word, ok: false, error: e instanceof Error ? e.message : String(e) });
        }
    }

    return Response.json({
        ok: true,
        requested: words.length,
        succeeded: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
    });
}

