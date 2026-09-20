import { describe, it, expect } from "bun:test";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { METRICS } from '../../src/lib/metrics';

// Regression guard for the "single source of truth" claim in src/lib/metrics.ts.
// The homepage (HeroMetrics, CareerSnapshot) and the value page read these
// numbers; if one drifts here, the value is no longer CV-authoritative.
describe('METRICS (CV-authoritative)', () => {
  it('matches the rendercv YAML figures', () => {
    expect(METRICS.abKyc).toEqual({ deltaPp: 5.72, annualEurK: 656 });
    expect(METRICS.retention).toEqual({ deltaPp: 9.2, ltvEurK: 227 });
    expect(METRICS.rfm).toEqual({ revenueBeforePct: 12, revenueAfterPct: 41 });
    expect(METRICS.bot).toEqual({ hoursBefore: 2, minutesAfter: 5 });
    expect(METRICS.portfolio).toEqual({ projects: 17, sqlCases: 26 });
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
  // SQL case repo is a sibling of the site repo under the same portfolio dir.
  const sqlCasesDir = join(siteRoot, '..', 'sql-analytics-case-study', 'cases');

  it('portfolio.projects matches the count of RU project cards on disk', () => {
    const cards = readdirSync(join(siteRoot, 'src', 'content', 'projects'))
      .filter((f) => f.endsWith('.md'));
    expect(METRICS.portfolio.projects as number).toBe(cards.length);
  });

  it('portfolio.sqlCases matches the count of .sql case files in sql-analytics-case-study', () => {
    const cases = readdirSync(sqlCasesDir).filter((f) => f.endsWith('.sql'));
    expect(METRICS.portfolio.sqlCases as number).toBe(cases.length);
  });
});