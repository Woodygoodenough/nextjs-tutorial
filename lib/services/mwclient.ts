export type MWDictionary = "collegiate" | "learners" | "medical" | "intermediate" | "elementary";

export type MWRawResponse = unknown;

export type MWLookupResult =
    | {
        kind: "entries";
        query: string;
        raw: MWRawResponse;
    }
    | {
        kind: "suggestions";
        query: string;
        suggestions: string[];
        raw: MWRawResponse;
    }
    | {
        kind: "empty";
        query: string;
        raw: MWRawResponse;
    }
    | {
        kind: "uncaptured";
        query: string;
        raw: MWRawResponse;
    };


interface MWClientOptions {
    apiKey: string;
    dictionary?: MWDictionary;
    /** Override base URL for testing. */
    baseUrl?: string;
    /** Provide your own fetch (handy for tests). */
    fetcher?: typeof fetch;
}

const DEFAULT_BASE_URL = "https://www.dictionaryapi.com/api/v3/references";

export class MWClient {
    private readonly apiKey: string;
    private readonly dictionary: MWDictionary;
    private readonly baseUrl: string;
    private readonly fetcher: typeof fetch;

    constructor(opts: MWClientOptions) {
        this.apiKey = opts.apiKey;
        this.dictionary = opts.dictionary ?? "collegiate";
        this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
        this.fetcher = opts.fetcher ?? fetch;
    }

    /**
     * Fetch the raw JSON array. This is useful for saving mock responses.
     */
    async fetchRaw(word: string): Promise<MWRawResponse> {
        const url = this.buildUrl(word);
        const res = await this.fetcher(url, { method: "GET" });
        if (!res.ok) {
            throw new Error(`MW API HTTP ${res.status} for "${word}"`);
        }
        return (await res.json()) as MWRawResponse;
    }

    /**
     * Fetch + parse into either entries or suggestions.
     */
    async fetchWord(word: string): Promise<MWLookupResult> {
        const raw = await this.fetchRaw(word);
        return parseMWResponse(word, raw);
    }

    private buildUrl(word: string): string {
        const encoded = encodeURIComponent(word.trim());
        return `${this.baseUrl}/${this.dictionary}/json/${encoded}?key=${encodeURIComponent(this.apiKey)}`;
    }
}

/**
 * Parse the MW response into a small, stable shape.
 *
 * Notes:
 * - If the response is an array of strings, MW is giving suggestions.
 * - If the response is an array of objects, those are dictionary entries.
 */
export function parseMWResponse(query: string, raw: MWRawResponse): MWLookupResult {
    if (!Array.isArray(raw)) {
        return { kind: "empty", query, raw };
    }

    if (raw.length === 0) {
        return { kind: "empty", query, raw };
    }

    // Misspelling / unknown -> suggestion list
    if (typeof raw[0] === "string") {
        const suggestions = raw.filter((x): x is string => typeof x === "string");
        return suggestions.length > 0
            ? { kind: "suggestions", query, suggestions, raw }
            : { kind: "empty", query, raw };
    }
    if (raw.length > 0 && typeof raw[0] === "object") {
        return { kind: "entries", query, raw };
    }
    return { kind: "uncaptured", query, raw };
}

export function createMWClientFromEnv(): MWClient {
    const apiKey = process.env.MW_API_KEY;
    if (!apiKey) throw new Error("Missing process.env.MW_API_KEY");

    const dictionary = (process.env.MW_DICTIONARY as MWDictionary | undefined) ?? "collegiate";
    return new MWClient({ apiKey, dictionary });
}

