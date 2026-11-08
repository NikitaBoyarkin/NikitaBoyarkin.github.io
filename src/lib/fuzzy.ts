/**
 * Typo tolerance for both search surfaces. Plain Levenshtein distance, DP with
 * an early exit on the row minimum — the index is tiny and this only runs after
 * exact/prefix matches miss. No library: a fuzzy scorer that ranks below every
 * exact tier is enough, and Pagefind 1.6 exposes no typo-tolerance knob.
 * ponytail: naive LD; swap for a trie/FA only if the index grows large.
 * Works for Cyrillic too — it compares char codes, not ASCII words.
 */

/** Edit distance when it is `<= max`, `Infinity` past the budget. */
export function distanceWithin(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return Infinity;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1, // deletion
        cur[j - 1] + 1, // insertion
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), // match/substitution
      );
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    // Levenshtein never shrinks across rows — bail once the cheapest full
    // alignment already exceeds max.
    if (rowMin > max) return Infinity;
    prev = cur;
  }
  return prev[b.length] <= max ? prev[b.length] : Infinity;
}

/** Boolean form — the Explorer still uses it for record-level typo checks. */
export function ldWithin(a: string, b: string, max = 2): boolean {
  return distanceWithin(a, b, max) <= max;
}

/** Lowercased words of `text`; punctuation and spaces are separators. */
export function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * How many edits a token of this length may spend: none under 4 characters
 * (short tokens fuzzy-match everything), one up to 6, two from 7.
 */
export function typoBudget(token: string): number {
  const n = [...token].length;
  if (n >= 7) return 2;
  if (n >= 4) return 1;
  return 0;
}

/**
 * Best distance from `token` to any of `words`. A word longer than the token
 * is also compared by its first `token.length` characters, so a typo inside a
 * stem still reaches the inflected form ("когорты" → "когортный").
 */
export function bestWordIn(token: string, words: string[], max = 2): number {
  let best = max + 1;
  for (const w of words) {
    const whole = distanceWithin(token, w, Math.min(max, best - 1));
    if (whole < best) best = whole;
    if (w.length > token.length) {
      const prefix = distanceWithin(token, w.slice(0, token.length), Math.min(max, best - 1));
      if (prefix < best) best = prefix;
    }
    if (best === 0) return 0;
  }
  return best <= max ? best : Infinity;
}

/** Same, for raw text. */
export function bestWordDistance(token: string, text: string, max = 2): number {
  return bestWordIn(token, wordsOf(text), max);
}
