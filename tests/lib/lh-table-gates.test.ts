import { describe, it, expect } from 'bun:test';
import { rowsFromReport } from '../../scripts/build-lh-table.mjs';

// The board's pass flags are a second gate on the same data `.lighthouserc.json`
// asserts. They drifted from it: one blanket gate applied to every row, so
// `/repo-audit/` and `/404.html` — both `noindex` by design, both with `seo`
// switched off in their assert matrix — were counted as failures on every run.
// `dct validate --strict` then failed the Lighthouse workflow for days on a
// discrepancy CI was not actually failing on.
//
// These cases bind the exception list to the matrix semantics, in both
// directions: an exempt page must pass, a normal page with the same score must
// still fail.

function report(path: string, scores: { perf: number; seo: number }) {
  return {
    finalUrl: `http://localhost:4321${path}`,
    fetchTime: '2026-10-31T20:00:00.000Z',
    categories: {
      performance: { score: scores.perf },
      accessibility: { score: 1 },
      'best-practices': { score: 1 },
      seo: { score: scores.seo },
    },
    audits: { 'color-contrast': { score: 1 } },
  };
}

describe('lh board gates mirror the assert matrices', () => {
  it('does not gate seo on the two noindex pages', () => {
    for (const path of ['/repo-audit/', '/404.html']) {
      const row = rowsFromReport('lhr-1.json', report(path, { perf: 0.98, seo: 0.63 }));
      expect(row.strict_pass, `${path} must pass with seo off`).toBe(1);
    }
  });

  it('still gates seo on an ordinary page', () => {
    const row = rowsFromReport('lhr-1.json', report('/projects/ab/', { perf: 0.98, seo: 0.63 }));
    expect(row.strict_pass).toBe(0);
  });

  it('applies the 0.75 performance floor only where the matrix does', () => {
    for (const path of ['/projects/volta/', '/colleague/', '/repo-audit/', '/404.html']) {
      const row = rowsFromReport('lhr-1.json', report(path, { perf: 0.8, seo: 1 }));
      expect(row.perf_pass, `${path} at 0.80 must clear its own floor`).toBe(1);
    }
    const ordinary = rowsFromReport('lhr-1.json', report('/', { perf: 0.8, seo: 1 }));
    expect(ordinary.perf_pass).toBe(0);
  });
});
