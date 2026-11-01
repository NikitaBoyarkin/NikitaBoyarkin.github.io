/**
 * Figure splitting — one contract for "which numbers in a sentence are figures".
 *
 * The site has one ink for measured results (`--text-accent-figure`, the brand
 * orange) and one for actions (`--text-accent`, the coral). Display blocks take
 * the first directly, but a case study states its result inside a sentence
 * («+9,09 п.п. удержания, p = 0,29–0,70»), and CSS cannot colour a digit inside
 * a text node. This module is the single place that decides where a figure
 * starts and ends; every surface that wants the figure ink in running text
 * consumes it (`FigureText.astro` for component strings, `figures-mdast.ts` for
 * authored markdown), so the rule can never drift between them.
 *
 * The rule is deliberately narrow: **a figure carries a unit, not a count.**
 * `+5,72`, `€208,5K`, `13,9×`, `95%`, `0,29`, `52–55%` are figures. Bare
 * integers — years, dates, «23 проекта», «Улика №3», `M3` — are not, because
 * colouring them turns every paragraph into zebra stripes and stops meaning
 * "this is the measured result". Dotted dates (`12.10.2025`) are explicitly
 * excluded: they are the one shape that looks like a decimal and is not.
 * Widening the rule means editing this file and nothing else.
 */

export interface FigureSpan {
  /** The run of text itself; concatenating every span reproduces the input. */
  text: string;
  /** True when this run is a figure and should take the figure ink. */
  figure: boolean;
}

// A number with optional sign, currency, thousands groups, decimal fraction, a
// `%` / `×` suffix or a single magnitude letter (`€208,5K`). Separators cover
// the ASCII, no-break (U+00A0) and narrow no-break (U+202F) spaces the site's
// own formatting emits.
const NUMBER = /[+\-−±]?[€$₽£]?\d(?:[\d\u00A0\u202F ]*\d)?(?:[.,]\d+)?(?:\s?[%×]|[KMB](?!\p{L}))?/gu;

// A range continues a figure: `52–55%`, `52 – 55%`, `0,29–0,70`. The dash is not
// part of the number, so `splitFigures` absorbs the tail rather than colouring
// half a range (a spaced dash used to defeat this and leave `52 – 55%` half-lit).
// Only horizontal space — `\s` would also eat a newline and fuse two lines.
const RANGE_TAIL =
  /^[ \t\u00A0\u202F]*[–—-][ \t\u00A0\u202F]*[+\-−±]?[€$₽£]?\d(?:[\d\u00A0\u202F ]*\d)?(?:[.,]\d+)?(?:\s?[%×]|[KMB](?!\p{L}))?/u;

// Dotted date: `12.10.2025`, `14.02.2024`. Matched numerals are skipped when the
// text at that offset is one of these, so the whole date stays plain — and the
// scan resumes after the date, so `12.10.2025–11.10.2026` cannot leak its second
// half through the range tail.
const DOTTED_DATE = /^\d{1,2}[.,]\d{1,2}[.,]\d{2,4}(?!\d)/u;

/**
 * A matched numeral counts as a figure when it carries a sign, a currency, a
 * percent/multiplier/magnitude suffix, or a decimal fraction — i.e. when it
 * reads as a measurement rather than as a count.
 */
export function isFigureToken(token: string): boolean {
  return (
    /^[+\-−±€$₽£]/.test(token) ||
    /([%×]|[KMB])$/.test(token) ||
    /[.,]\d/.test(token)
  );
}

/**
 * Split `input` into alternating plain and figure runs. Joining every span's
 * `text` returns the input unchanged — callers rely on that, and the test suite
 * asserts it, so no surface can silently swallow a character.
 */
export function splitFigures(input: string): FigureSpan[] {
  if (!input) return [];

  const spans: FigureSpan[] = [];
  let cursor = 0;
  NUMBER.lastIndex = 0;

  for (let match = NUMBER.exec(input); match; match = NUMBER.exec(input)) {
    const start = match.index;

    // A digit glued to a letter is part of an identifier (M3, B2B, py3), not a
    // figure. Cheaper and safer than trying to enumerate the identifiers.
    const before = start > 0 ? input[start - 1] : '';
    if (before && /[\p{L}\p{N}]/u.test(before)) continue;

    let token = match[0];
    let end = start + token.length;

    // Whole ranges are one figure or none: `52–55%` must not colour only `55%`.
    const tail = RANGE_TAIL.exec(input.slice(end));
    if (tail) {
      token += tail[0];
      end += tail[0].length;
    }

    if (DOTTED_DATE.test(input.slice(start))) {
      // Resume past the whole date, or the tail of a compact range
      // (`12.10.2025–11.10.2026`) would be picked up as `2025–11.10`.
      const date = DOTTED_DATE.exec(input.slice(start))![0];
      NUMBER.lastIndex = start + date.length;
      continue;
    }
    if (!isFigureToken(token)) continue;

    if (start > cursor) spans.push({ text: input.slice(cursor, start), figure: false });
    spans.push({ text: token, figure: true });
    cursor = end;
    NUMBER.lastIndex = end;
  }

  if (cursor < input.length) spans.push({ text: input.slice(cursor), figure: false });
  return spans;
}
