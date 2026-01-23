/**
 * Generate likely "base" forms for MW stem strings, in normalized space.
 *
 * We only ever use these as *fallback candidates* when exact stem_norm matching fails,
 * and we still guard by requiring the candidate to exist in the entry's `meta.stems[]`.
 *
 * Examples:
 * - databases -> database
 * - candidest -> candid
 * - beautifuler -> beautiful
 * - databasing -> database
 */
export function morphBaseCandidates(norm: string): string[] {
  const out: string[] = [];
  const push = (s: string | null | undefined) => {
    if (!s) return;
    if (s === norm) return;
    if (s.length < 2) return;
    if (!out.includes(s)) out.push(s);
  };

  const pushCollapsedDoubleFinal = (s: string | null | undefined) => {
    if (!s) return;
    // Common spelling alternations: doubled final consonant before suffix.
    // Example: focusses -> focuss -> focus
    if (s.length >= 3 && /(.)\1$/.test(s)) {
      push(s.slice(0, -1));
    }
  };

  // --- Plurals ---
  // - parties -> party
  if (norm.endsWith("ies") && norm.length > 3) {
    push(`${norm.slice(0, -3)}y`);
  }
  // - tenaciousnesses -> tenaciousness
  // - databases -> database  (note: try both -es and -s; pick the one that exists in stems)
  if (norm.endsWith("es") && norm.length > 2) {
    const a = norm.slice(0, -2);
    const b = norm.slice(0, -1);
    push(a);
    push(b);
    pushCollapsedDoubleFinal(a);
    pushCollapsedDoubleFinal(b);
  } else if (norm.endsWith("s") && !norm.endsWith("ss") && norm.length > 1) {
    const a = norm.slice(0, -1);
    push(a);
    pushCollapsedDoubleFinal(a);
  }

  // --- Comparatives / superlatives ---
  // - prettier -> pretty
  if (norm.endsWith("ier") && norm.length > 3) push(`${norm.slice(0, -3)}y`);
  // - prettier / beautifuler -> pretty / beautiful
  if (norm.endsWith("er") && norm.length > 2) {
    const a = norm.slice(0, -2); // bigger -> bigg (guarded by stems)
    const b = norm.slice(0, -1); // nicer -> nice (guarded by stems)
    push(a);
    push(b);
    pushCollapsedDoubleFinal(a);
  }

  // - happiest -> happy
  if (norm.endsWith("iest") && norm.length > 4) push(`${norm.slice(0, -4)}y`);
  // - candidest -> candid, nicest -> nice (via -st)
  if (norm.endsWith("est") && norm.length > 3) {
    const a = norm.slice(0, -3);
    const b = norm.slice(0, -2);
    push(a);
    push(b);
    pushCollapsedDoubleFinal(a);
  }

  // --- Present participles / gerunds ---
  // - databasing -> database
  if (norm.endsWith("ing") && norm.length > 3) {
    const base = norm.slice(0, -3);
    push(base);
    push(base.endsWith("e") ? base : `${base}e`);
    pushCollapsedDoubleFinal(base);
  }

  // --- Past tense / participles ---
  // - databased -> database
  if (norm.endsWith("ied") && norm.length > 3) {
    push(`${norm.slice(0, -3)}y`);
  }
  if (norm.endsWith("ed") && norm.length > 2) {
    const base = norm.slice(0, -2);
    push(base);
    push(base.endsWith("e") ? base : `${base}e`);
    pushCollapsedDoubleFinal(base);
  }

  return out;
}

