import { describe, it, expect } from 'bun:test';
import { groupByYear } from '../../src/lib/projects';

/**
 * Binds the HR landing's list order (`ProjectList.astro`): years newest first,
 * projects newest first inside a year, `PROJECT_ORDER` breaking date ties. The
 * tie-break is not cosmetic — four projects carry the same 2026-08-11 date, so
 * without it the order would follow `getCollection`'s filesystem order and
 * shuffle between builds.
 *
 * What fails when the claim stops being true: a reordered comparator, a year
 * boundary taken from UTC instead of local time, or a project silently dropped
 * because the fallback date stopped being read.
 *
 * NOT bound here: whether the real dates are truthful — that lives in
 * `project-dates.test.ts`.
 */

interface Stub {
  id: string;
  date?: Date;
  updated?: Date;
}

const at = (iso: string): Date => new Date(`${iso}T00:00:00`);

describe('groupByYear', () => {
  it('orders years newest first, and projects newest first inside a year', () => {
    const groups = groupByYear<Stub>([
      { id: 'cohort.md', date: at('2026-07-12') },
      { id: 'rfm.md', date: at('2025-12-06') },
      { id: 'rag.md', date: at('2026-10-10') },
      { id: 'ab.md', date: at('2026-08-22') },
    ]);

    expect(groups.map((g) => g.year)).toEqual([2026, 2025]);
    expect(groups[0]?.projects.map((p) => p.id)).toEqual(['rag.md', 'ab.md', 'cohort.md']);
    expect(groups[1]?.projects.map((p) => p.id)).toEqual(['rfm.md']);
  });

  it('breaks a shared date with PROJECT_ORDER, not with the input order', () => {
    // All three share a date, as their content files actually do. The input is
    // PROJECT_ORDER reversed; the expected order is PROJECT_ORDER itself
    // (volta, garden, site), not the date order and not the input order.
    const groups = groupByYear<Stub>([
      { id: 'site.md', date: at('2026-08-11') },
      { id: 'garden.md', date: at('2026-08-11') },
      { id: 'volta.md', date: at('2026-08-11') },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.projects.map((p) => p.id)).toEqual(['volta.md', 'garden.md', 'site.md']);
  });

  it('falls back to `updated` when `date` is absent', () => {
    const groups = groupByYear<Stub>([
      { id: 'volta.md', date: at('2026-08-11') },
      { id: 'sql.md', updated: at('2025-03-01') },
    ]);

    expect(groups.map((g) => g.year)).toEqual([2026, 2025]);
  });

  it('drops an undated project instead of inventing a year for it', () => {
    const groups = groupByYear<Stub>([
      { id: 'volta.md', date: at('2026-08-11') },
      { id: 'sql.md' },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.projects.map((p) => p.id)).toEqual(['volta.md']);
  });

  it('returns no groups for an empty catalogue', () => {
    expect(groupByYear<Stub>([])).toEqual([]);
  });
});
