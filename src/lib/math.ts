import { nextMathSpan } from './katex-math';

/**
 * Does this markdown body contain a math span the `katexMath` plugin will turn
 * into `.katex` markup?
 *
 * Used to decide whether a page mounts `MathStyles.astro` (KaTeX ships ~28 KB
 * of CSS with 20 base64 fonts; 30 of 223 built pages contain a formula).
 * Deliberately the same matcher the plugin uses, so the page and the stylesheet
 * cannot disagree about what counts as math — a second, hand-written regex here
 * is exactly the drift that leaves formulas unstyled.
 *
 * A `$` inside a fenced block is not math for the plugin, but this function
 * only sees the raw body: a false positive ships one extra stylesheet, which is
 * cheap. A false negative would render a formula unstyled, so
 * `tests/built/katex-coverage.test.ts` checks the built HTML instead of trusting
 * this function's callers.
 */
export function hasMath(body: string | undefined | null): boolean {
  if (!body) return false;
  return nextMathSpan(body, 0) !== null;
}
