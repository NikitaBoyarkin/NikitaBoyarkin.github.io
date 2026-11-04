import { describe, it, expect } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { METRICS } from '../../src/lib/metrics';

// Regression guard for the "single source of truth" claim in src/lib/metrics.ts.
// The homepage (CareerSnapshot) and ValueOffers on /about#value
// read these numbers; if one drifts here, the value is no longer CV-authoritative.
describe('METRICS (CV-authoritative)', () => {
  it('matches the rendercv YAML figures', () => {
    expect(METRICS.abKyc).toEqual({ deltaPp: 5.72, annualEurK: 208.5, roiX: 13.9 });
    expect(METRICS.retention).toEqual({ deltaPp: 9.2, ltvEurK: 282 });
    expect(METRICS.rfm).toEqual({ revenueBeforePct: 12, revenueAfterPct: 41 });
    expect(METRICS.bot).toEqual({ hoursBefore: 2, minutesAfter: 5 });
    // `projects` is not a CV figure (the CV lists 26 SQL cases, not a card count);
    // it is pinned here so a metrics.ts edit cannot slip past review silently.
    expect(METRICS.portfolio).toEqual({ projects: 31, sqlCases: 26 });
  });
});

// Drift guard (PRD v6 S1.8 / §9): the metrics.ts numbers must agree with the
// real artifacts they summarise, so the drift cannot silently return. We count
// the actual files on disk and assert metrics.ts matches. If a case is added or
// removed without updating metrics.ts (or vice-versa), this test goes red.
describe('METRICS drift guard (S1.8)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  // Site repo root = tests/lib -> ../.. ; project cards live under it.
  const siteRoot = join(here, '..', '..');
  // SQL case repo is a sibling of the site repo under the same portfolio dir
  // (local dev). CI checks the site repo out alone, so the workflow checks the
  // public case-study repo out into `vendor/` and points SQL_CASES_DIR at it.
  const sqlCasesDir =
    process.env.SQL_CASES_DIR ?? join(siteRoot, '..', 'sql-analytics-case-study', 'cases');

  it('portfolio.projects matches the count of RU project cards on disk', () => {
    const cards = readdirSync(join(siteRoot, 'src', 'content', 'projects'))
      .filter((f) => f.endsWith('.md'));
    expect(METRICS.portfolio.projects as number).toBe(cards.length);
  });

  it('portfolio.sqlCases matches the count of .sql case files in sql-analytics-case-study', () => {
    // Fail loudly rather than skipping: a guard that cannot see its evidence
    // must go red, not silently pass.
    expect(existsSync(sqlCasesDir)).toBe(true);
    const cases = readdirSync(sqlCasesDir).filter((f) => f.endsWith('.sql'));
    expect(METRICS.portfolio.sqlCases as number).toBe(cases.length);
  });

  // The KYC impact is not a CV figure — it is a claim the Volta case page makes,
  // and the case page is the source of truth the site promises. metrics.ts
  // claimed a guard of this shape from the start, but the metric and the case
  // had drifted apart with nothing to catch it. This binds the two: edit either
  // side alone and the suite goes red.
  it('abKyc.annualEurK matches the claim on the Volta case page', () => {
    const caseRu = readFileSync(join(siteRoot, 'src', 'content', 'projects', 'volta.md'), 'utf8');
    // The claim itself, verbatim. If the case re-words it, this test should be
    // updated deliberately — not worked around.
    expect(caseRu).toContain('€208,5K за 12 месяцев');
    // And the metric, printed the RU way, must be the number inside that claim.
    const printed = String(METRICS.abKyc.annualEurK).replace('.', ',');
    expect(caseRu).toContain(`€${printed}K за 12 месяцев`);
  });

  // The ROI multiple rides the same claim ("при 13,9× ROI"), and it had drifted
  // into three copies — the hero, the key-figures band and the career snapshot.
  // Same binding, same source page.
  it('abKyc.roiX matches the ROI stated on the Volta case page', () => {
    const caseRu = readFileSync(join(siteRoot, 'src', 'content', 'projects', 'volta.md'), 'utf8');
    const printed = String(METRICS.abKyc.roiX).replace('.', ',');
    expect(caseRu).toContain(`${printed}× ROI`);
  });

  // The retention LTV is the second claim of the same shape, and it is the one
  // that actually drifted: the case page was corrected 227 → 282 while
  // metrics.ts kept 227, so `/about` and `/projects/volta/` printed different
  // money for one number and no gate noticed. `abKyc` got a guard when the
  // single-source-of-truth claim was written; `retention` did not. This closes
  // that asymmetry — edit the part page alone and the suite goes red.
  it('retention.ltvEurK matches the claim on the Volta retention part', () => {
    const partRu = readFileSync(
      join(siteRoot, 'src', 'content', 'volta-parts', 'retention.md'),
      'utf8'
    );
    // The claim itself, verbatim. If the part re-words it, update this test
    // deliberately — do not work around it.
    expect(partRu).toContain('€282K/год');
    // And the metric, printed the RU way, must be the number inside that claim.
    const printed = String(METRICS.retention.ltvEurK);
    expect(partRu).toContain(`€${printed}K/год`);
  });
});