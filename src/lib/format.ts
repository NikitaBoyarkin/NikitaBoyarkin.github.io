// Locale formatting for the numbers the site prints.
//
// The curated copy (ROLE_COPY, metrics) already follows the RU convention — a
// comma decimal separator ("+5,72 п.п."). The computed surfaces used to print
// `Number.toFixed`, which is always a dot, so the same KYC metric read "+5,72"
// in one place and "+5.72" in another. One helper removes the drift.

/** Decimal separator for a locale: RU uses a comma, EN a dot. */
export function decimalSeparator(lang: 'ru' | 'en' = 'ru'): string {
  return lang === 'en' ? '.' : ',';
}

/**
 * Format a number for display in `lang`. Pass `decimals` to fix the precision;
 * omit it to print the value as-is (so `9.2` stays "9,2", not "9,20").
 */
export function formatNumber(value: number, decimals?: number, lang: 'ru' | 'en' = 'ru'): string {
  const s = decimals && decimals > 0 ? value.toFixed(decimals) : String(value);
  return lang === 'en' ? s : s.replace('.', ',');
}
