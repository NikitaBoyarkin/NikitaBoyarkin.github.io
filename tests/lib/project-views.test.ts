import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_PROJECT_VIEW,
  FRESH_LIMIT,
  PROJECT_VIEWS,
  REAL_DATASETS,
  datasetLabel,
  freshProjects,
  isProjectViewKey,
  isRealDataset,
  projectTableRows,
  projectViews,
  sortByFreshness,
} from '../../src/lib/projects';
import { formatDate } from '../../src/lib/date';

// Frontmatter dates parse as UTC midnight (`z.coerce.date()` on a `YYYY-MM-DD`
// string), so fixtures are built the same way — a local-midnight Date would shift
// the ISO day for anyone west of UTC and make the table assertions timezone-dependent.
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

const PROJECT_CARD = join(import.meta.dir, '../../src/components/ProjectCard.astro');

describe('PROJECT_VIEWS', () => {
  it('lists the four lenses in order, with both labels', () => {
    expect(PROJECT_VIEWS.map((view) => view.key)).toEqual(['tracks', 'real', 'fresh', 'table']);
    expect(PROJECT_VIEWS.map((view) => view.ru)).toEqual([
      'По трекам',
      'Реальные данные',
      'Свежие',
      'Таблица',
    ]);
    expect(PROJECT_VIEWS.map((view) => view.en)).toEqual([
      'By track',
      'Real data',
      'Fresh',
      'Table',
    ]);
  });

  it('defaults to the board', () => {
    expect(DEFAULT_PROJECT_VIEW).toBe('tracks');
    expect(PROJECT_VIEWS[0].key).toBe(DEFAULT_PROJECT_VIEW);
  });

  it('localizes the switch, defaulting to Russian', () => {
    expect(projectViews('en')).toEqual(
      PROJECT_VIEWS.map((view) => ({ key: view.key, label: view.en })),
    );
    expect(projectViews()).toEqual(
      PROJECT_VIEWS.map((view) => ({ key: view.key, label: view.ru })),
    );
  });
});

describe('isProjectViewKey', () => {
  it('accepts every declared key', () => {
    for (const { key } of PROJECT_VIEWS) expect(isProjectViewKey(key)).toBe(true);
  });

  it('rejects anything else, including absent values', () => {
    expect(isProjectViewKey('foo')).toBe(false);
    expect(isProjectViewKey('')).toBe(false);
    expect(isProjectViewKey(null)).toBe(false);
    expect(isProjectViewKey(undefined)).toBe(false);
  });
});

describe('sortByFreshness', () => {
  it('puts the newest first', () => {
    const input = [
      { id: 'sql.md', date: day('2025-06-19') },
      { id: 'volta.md', date: day('2026-10-20') },
    ];
    expect(sortByFreshness(input).map((p) => p.id)).toEqual(['volta.md', 'sql.md']);
  });

  it('prefers `updated` over `date`', () => {
    const input = [
      { id: 'ab.md', date: day('2026-08-01') },
      { id: 'sql.md', date: day('2026-01-01'), updated: day('2026-09-01') },
    ];
    expect(sortByFreshness(input).map((p) => p.id)).toEqual(['sql.md', 'ab.md']);
  });

  it('sinks an undated project to the end', () => {
    const input = [
      { id: 'sql.md' },
      { id: 'volta.md', date: day('2020-01-01') },
      { id: 'ab.md', updated: day('2019-01-01') },
    ];
    expect(sortByFreshness(input).map((p) => p.id)).toEqual(['volta.md', 'ab.md', 'sql.md']);
  });

  it('breaks a shared date by PROJECT_ORDER, not by input order', () => {
    // volta (0), ab (1), games (2) — the curated rank decides, so the same date
    // cannot reshuffle the list between builds.
    const tied = day('2026-08-11');
    const shuffled = [
      { id: 'games.md', date: tied },
      { id: 'volta.md', date: tied },
      { id: 'ab.md', date: tied },
    ];
    expect(sortByFreshness(shuffled).map((p) => p.id)).toEqual([
      'volta.md',
      'ab.md',
      'games.md',
    ]);
  });

  it('does not mutate the input', () => {
    const input = [
      { id: 'sql.md', date: day('2025-06-19') },
      { id: 'volta.md', date: day('2026-10-20') },
    ];
    sortByFreshness(input);
    expect(input.map((p) => p.id)).toEqual(['sql.md', 'volta.md']);
  });
});

describe('freshProjects', () => {
  const dated = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      id: `volta.md`,
      date: day('2026-01-01'),
      index,
    }));

  it('shows at most FRESH_LIMIT projects by default', () => {
    expect(FRESH_LIMIT).toBe(12);
    expect(freshProjects(dated(FRESH_LIMIT + 5))).toHaveLength(FRESH_LIMIT);
  });

  it('honours a custom limit', () => {
    expect(freshProjects(dated(20), 3)).toHaveLength(3);
    expect(freshProjects(dated(2), 10)).toHaveLength(2);
  });

  it('takes the freshest slice, not the first slice', () => {
    const input = [
      { id: 'sql.md', date: day('2024-01-01') },
      { id: 'volta.md', date: day('2026-10-20') },
      { id: 'ab.md', date: day('2025-01-01') },
    ];
    expect(freshProjects(input, 1).map((p) => p.id)).toEqual(['volta.md']);
  });
});

describe('dataset provenance', () => {
  it('declares real and mixed as the real-data datasets', () => {
    expect(REAL_DATASETS).toEqual(['real', 'mixed']);
  });

  it('treats real and mixed as real, synthetic and absent as not', () => {
    expect(isRealDataset('real')).toBe(true);
    expect(isRealDataset('mixed')).toBe(true);
    expect(isRealDataset('synthetic')).toBe(false);
    expect(isRealDataset(undefined)).toBe(false);
  });

  it('labels only the non-default datasets', () => {
    expect(datasetLabel('synthetic')).toBeNull();
    expect(datasetLabel(undefined)).toBeNull();
    expect(datasetLabel('real')).toBe('Реальные данные');
    expect(datasetLabel('mixed')).toBe('Реальные + синтетика');
    expect(datasetLabel('real', 'en')).toBe('Real data');
    expect(datasetLabel('mixed', 'en')).toBe('Real + synthetic');
  });
});

describe('projectTableRows', () => {
  type RowSource = {
    id: string;
    title: string;
    track: string;
    tools: string[];
    date?: Date;
    updated?: Date;
    dataset?: 'synthetic' | 'real' | 'mixed';
    github?: string;
    private?: boolean;
  };

  const entry = (slug: string, title: string, extra: Partial<RowSource> = {}): RowSource => ({
    id: `${slug}.md`,
    title,
    track: 'analytics',
    tools: ['SQL'],
    ...extra,
  });

  it('keeps the curated PROJECT_ORDER regardless of input order', () => {
    const rows = projectTableRows(
      [
        entry('site', 'Site'),
        entry('sql', 'SQL'),
        entry('volta', 'Volta'),
        entry('brand-new', 'New'),
      ],
      {},
    );
    expect(rows.map((row) => row.slug)).toEqual(['volta', 'sql', 'site', 'brand-new']);
  });

  it('builds a locale-relative href and normalizes the prefix', () => {
    const [volta] = projectTableRows([entry('volta', 'Volta')], {});
    expect(volta.href).toBe('projects/volta/');

    const withEn = projectTableRows([entry('volta', 'Volta')], { linkPrefix: 'en/' });
    expect(withEn[0].href).toBe('en/projects/volta/');

    // Both edge cases must land on one slash, never `en//projects/…`.
    for (const linkPrefix of ['en', 'en/', 'en//']) {
      const [row] = projectTableRows([entry('volta', 'Volta')], { linkPrefix });
      expect(row.href, `linkPrefix "${linkPrefix}"`).toBe('en/projects/volta/');
    }
  });

  it('prints dates in the locale, not as ISO slugs', () => {
    const [row] = projectTableRows(
      [entry('sql', 'SQL', { date: day('2026-08-11'), updated: day('2026-10-20') })],
      {},
    );
    // The cell is a display string, so it must equal what the fresh lens prints
    // for the same date — one formatter, two views.
    expect(row.published).toBe(formatDate(day('2026-08-11'), 'ru'));
    expect(row.updated).toBe(formatDate(day('2026-10-20'), 'ru'));
    expect(row.published).not.toBe('2026-08-11');

    // …and the EN twin differs by locale rather than by code path.
    const [en] = projectTableRows(
      [entry('sql', 'SQL', { date: day('2026-08-11') })],
      { lang: 'en' },
    );
    expect(en.published).toBe(formatDate(day('2026-08-11'), 'en'));

    const [undated] = projectTableRows([entry('site', 'Site')], {});
    expect(undated.published).toBeNull();
    expect(undated.updated).toBeNull();
  });

  it('maps privacy, github and the localized track/dataset labels', () => {
    const [row] = projectTableRows(
      [
        entry('sql', 'SQL', {
          track: 'experiments',
          dataset: 'real',
          github: 'https://github.com/NikitaBoyarkin/sql',
          private: true,
        }),
      ],
      {},
    );
    expect(row.track).toBe('Эксперименты');
    expect(row.dataset).toBe('Реальные данные');
    expect(row.github).toBe('https://github.com/NikitaBoyarkin/sql');
    expect(row.isPrivate).toBe(true);
    expect(row.tools).toEqual(['SQL']);
  });

  it('defaults to a public, github-less, unlabelled row and localizes for EN', () => {
    const [row] = projectTableRows([entry('ab', 'AB', { dataset: 'mixed' })], { lang: 'en' });
    expect(row.github).toBeNull();
    expect(row.isPrivate).toBe(false);
    expect(row.track).toBe('Analytics');
    expect(row.dataset).toBe('Real + synthetic');
  });
});

describe('datasetLabel mirrors ProjectCard.astro', () => {
  // The card renders the badge from its own `i18n` object because it cannot
  // import a helper per-label without duplicating it in the template; this test
  // is the mechanism that turns a rename on either side red instead of leaving
  // two silently different strings for the same claim.
  it('still contains every exact string datasetLabel returns', () => {
    const source = readFileSync(PROJECT_CARD, 'utf8');
    for (const dataset of ['real', 'mixed'] as const) {
      for (const lang of ['ru', 'en'] as const) {
        const label = datasetLabel(dataset, lang);
        expect(label, `${dataset}/${lang} has no label`).not.toBeNull();
        expect(source, `ProjectCard.astro does not render "${label}"`).toContain(label!);
      }
    }
  });
});
