import { searchMW } from "@/lib/services/learning-unit-search";
import { persistSearchResult } from "@/lib/services/learning-unit-search";
import { GetUnitResult } from "@/lib/types/commons";

async function resolveSearchAndPersist(lookupKey: string): Promise<GetUnitResult> {
    const result = await searchMW(lookupKey);
    await persistSearchResult(result);
    return result;
}
export async function GET() {
    const words = [
        // 200 words: normal vocab + deliberate morphological variants to stress-test stem anchoring.


        // Plurals / -es / -ies (surface-form variants)
        "context",
        "contexts",
        "analysis",
        "analyses",
        "category",
        "categories",
        "theory",
        "theories",
        "party",
        "parties",
        "city",
        "cities",
        "class",
        "classes",
        "box",
        "boxes",
        "hero",
        "heroes",
        "echo",
        "echoes",
        "tomato",
        "tomatoes",
        "potato",
        "potatoes",
        "database",
        "databases",
        "process",
        "processes",
        "status",
        "statuses",
        "index",
        "indices",
        "matrix",
        "matrices",
        "vertex",
        "vertices",

        // -ing / -ed (gerunds / participles)
        "databasing",
        "databased",
        "innovating",
        "innovated",
        "organizing",
        "organized",
        "modeling",
        "modeled",
        "debugging",
        "debugged",
        "labeling",
        "labeled",
        "parsing",
        "parsed",
        "anchoring",
        "anchored",
        "learning",
        "learned",
        "reasoning",
        "reasoned",
        "focusing",
        "focused",
        "clarifying",
        "clarified",

        // Comparatives / superlatives (including “weird” but seen-in-the-wild stems)
        "candid",
        "candidest",
        "beautiful",
        "beautifuler",
        "simple",
        "simpler",
        "simplest",
        "gentle",
        "gentler",
        "gentlest",
        "subtle",
        "subtler",
        "subtlest",
        "bright",
        "brighter",
        "brightest",
        "quiet",
        "quieter",
        "quietest",
        "happy",
        "happier",
        "happiest",

        // Proper nouns / capitalization cases (normalization should make these behave consistently)
        "China",
        "china",
        "Paris",
        "paris",
        "Amazon",
        "amazon",
        "Mercury",
        "mercury",
        "Python",
        "python",

        // MW-style stems we explicitly care about
        "tenacious",
        "tenaciousness",
        "tenaciousnesses",
        "contextual",
        "contextualizing",
        "contextualized",

        // Normal “core” vocab (broad variety)
        "serendipity",
        "diligent",
        "resilience",
        "curiosity",
        "insight",
        "nuance",
        "empathy",
        "eloquent",
        "meticulous",
        "ambiguous",
        "pragmatic",
        "paradox",
        "ephemeral",
        "ubiquitous",
        "quintessential",
        "innovation",
        "algorithm",
        "synthesis",
        "hypothesis",
        "anomaly",
        "spectrum",
        "catalyst",
        "equilibrium",
        "trajectory",
        "momentum",
        "friction",
        "entropy",
        "probability",
        "statistics",
        "calculus",
        "geometry",
        "algebra",
        "topology",
        "cryptography",
        "encryption",
        "compression",
        "bandwidth",
        "latency",
        "throughput",
        "concurrency",
        "parallelism",
        "synchronization",
        "consistency",
        "availability",
        "durability",
        "scalability",
        "observability",
        "telemetry",
        "instrumentation",
        "refactoring",
        "abstraction",
        "encapsulation",
        "polymorphism",
        "inheritance",
        "composition",
        "idempotent",
        "deterministic",
        "stochastic",
        "heuristic",
        "semantic",
        "lexical",
        "morphology",
        "phonetic",
        "pronunciation",
        "etymology",
        "taxonomy",
        "ontology",
        "epistemology",
        "aesthetics",
        "ethics",
        "logic",
        "rhetoric",
        "architecture",
        "astronomy",
        "botany",
        "chemistry",
        "ecology",
        "geology",
        "meteorology",
        "neurology",
        "physiology",
        "psychology",
        "sociology",
        "anthropology",
        "philosophy",

        "literature",

        "history",
        "economics",
        "entrepreneur",
        "initiative",
        "collaboration",
        "coordination",
        "negotiation",
        "persuasion",
        "adaptability",
        "accountability",
        "integrity",
        "humility",
        "gratitude",
        "compassion",
        "patience",
        "precision",

    ];

    const results: Array<{ word: string; ok: boolean; status?: string; error?: string }> = [];
    for (const word of words) {
        try {
            const r = await resolveSearchAndPersist(word);
            results.push({ word, ok: true, status: r.status });
        } catch (e) {
            const err = e as any;
            const message = err instanceof Error ? err.message : String(err);
            const root = err?.cause ?? err;
            const code = typeof root?.code === "string" ? root.code : null;
            const constraint = typeof root?.constraint === "string" ? root.constraint : null;
            const detail = typeof root?.detail === "string" ? root.detail : null;
            const where = typeof root?.where === "string" ? root.where : null;
            const hint = typeof root?.hint === "string" ? root.hint : null;
            const causeMessage = err?.cause?.message && err?.cause?.message !== message ? err.cause.message : null;
            results.push({
                word,
                ok: false,
                error:
                    message +
                    (causeMessage ? ` (cause=${causeMessage})` : "") +
                    (code ? ` (code=${code})` : "") +
                    (constraint ? ` (constraint=${constraint})` : "") +
                    (detail ? ` (detail=${detail})` : "") +
                    (where ? ` (where=${where})` : "") +
                    (hint ? ` (hint=${hint})` : ""),
            });
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

