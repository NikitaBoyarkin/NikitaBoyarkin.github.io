import { describe, it, expect } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AUDIENCES,
  DEFAULT_AUDIENCE,
  PROJECT_ORDER,
  PROJECT_SPHERES,
  SPHERES,
  ROLE_COPY,
  ROLE_CURATION,
  ALL_SPHERES,
  ALL_TOOLS,
  emptyToolKeys,
  groupByTrack,
  matchesSphere,
  matchesTool,
  projectSphere,
  projectSphereFilters,
  projectToolFilters,
  sortByProjectOrder,
  sortSlugsByNewest,
  stripExt,
  trackCounts,
} from '../../src/lib/projects';

type Fixture = { id: string; track: string; tools: string[] };

const project = (slug: string, track: string, tools: string[] = []): Fixture => ({
  id: `${slug}.md`,
  track,
  tools,
});

// Mirrors the RU catalogue's shape (counts per track) with a compact fixture.
const catalogue: Fixture[] = [
  project('volta', 'experiments', ['Python', 'SciPy / Statsmodels']),
  project('ab', 'experiments', ['Python', 'Jupyter Notebook']),
  project('sql', 'analytics', ['SQL', 'Tableau (Hyper API)']),
  project('cohort', 'analytics', ['Python', 'matplotlib / seaborn', 'Tableau (Hyper API)']),
  project('supabase', 'product', ['TypeScript']),
  project('site', 'engineering', ['TypeScript', 'Astro']),
];

describe('stripExt', () => {
  it('drops the markdown extension', () => {
    expect(stripExt('cohort.md')).toBe('cohort');
    expect(stripExt('cohort')).toBe('cohort');
  });
});

describe('sortByProjectOrder', () => {
  it('orders by PROJECT_ORDER regardless of input order', () => {
    const shuffled = [...catalogue].reverse();
    const order = sortByProjectOrder(shuffled).map((p) => stripExt(p.id));
    expect(order).toEqual(['volta', 'ab', 'supabase', 'sql', 'cohort', 'site']);
  });

  it('sinks unknown slugs to the end, keeping the canonical head', () => {
    const withNew = [project('brand-new', 'analytics'), ...catalogue];
    const order = sortByProjectOrder(withNew).map((p) => stripExt(p.id));
    expect(order[0]).toBe('volta');
    expect(order[order.length - 1]).toBe('brand-new');
  });

  it('does not mutate the input array', () => {
    const input = [...catalogue].reverse();
    const before = input.map((p) => p.id);
    sortByProjectOrder(input);
    expect(input.map((p) => p.id)).toEqual(before);
  });

  it('covers every known slug exactly once', () => {
    const slugs = sortByProjectOrder(catalogue).map((p) => stripExt(p.id));
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.every((s) => PROJECT_ORDER.includes(s))).toBe(true);
  });
});

describe('groupByTrack', () => {
  it('keeps taxonomy order and drops empty tracks', () => {
    const groups = groupByTrack(catalogue);
    expect(groups.map((g) => g.key)).toEqual([
      'experiments',
      'analytics',
      'product',
      'engineering',
    ]);
  });

  it('omits a track with no projects', () => {
    const noProduct = catalogue.filter((p) => p.track !== 'product');
    expect(groupByTrack(noProduct).map((g) => g.key)).not.toContain('product');
  });

  it('localizes the labels', () => {
    expect(groupByTrack(catalogue, 'en')[0].label).toBe('Experiments');
    expect(groupByTrack(catalogue, 'ru')[0].label).toBe('Эксперименты');
  });
});

describe('trackCounts', () => {
  it('counts projects per track, including empty tracks as 0', () => {
    const counts = trackCounts(catalogue);
    expect(counts).toEqual({ experiments: 2, analytics: 2, product: 1, engineering: 1 });
  });

  it('reports 0 for a track with no projects', () => {
    const onlyAnalytics = catalogue.filter((p) => p.track === 'analytics');
    expect(trackCounts(onlyAnalytics).engineering).toBe(0);
    expect(trackCounts(onlyAnalytics).analytics).toBe(2);
  });

  it('keeps taxonomy keys in a stable order', () => {
    expect(Object.keys(trackCounts(catalogue))).toEqual([
      'experiments',
      'analytics',
      'product',
      'engineering',
    ]);
  });
});

describe('projectToolFilters', () => {
  it('prepends a localized "all" chip and keeps a stable order', () => {
    expect(projectToolFilters('ru').map((t) => t.key)).toEqual([
      ALL_TOOLS,
      'python',
      'sql',
      'tableau',
      'jupyter',
      'typescript',
    ]);
    expect(projectToolFilters('ru')[0].label).toBe('Все инструменты');
    expect(projectToolFilters('en')[0].label).toBe('All tools');
  });
});

describe('matchesTool', () => {
  it('treats "all" as a pass-through', () => {
    expect(matchesTool([], ALL_TOOLS)).toBe(true);
  });

  it('matches a substring case-insensitively', () => {
    expect(matchesTool(['Tableau (Hyper API)'], 'tableau')).toBe(true);
    expect(matchesTool(['Jupyter Notebook'], 'jupyter')).toBe(true);
    expect(matchesTool(['Python'], 'sql')).toBe(false);
  });

  it('matches across the whole tool list', () => {
    expect(matchesTool(['Python', 'SQL'], 'sql')).toBe(true);
  });
});

describe('emptyToolKeys', () => {
  it('lists the tool keys with zero matches in the given set', () => {
    const experiments = catalogue.filter((p) => p.track === 'experiments');
    // experiments: Python + Jupyter — nothing SQL/Tableau/TypeScript.
    expect(emptyToolKeys(experiments).sort()).toEqual(['sql', 'tableau', 'typescript']);
  });

  it('never lists the "all" chip', () => {
    expect(emptyToolKeys([])).not.toContain(ALL_TOOLS);
  });

  it('is empty when every tool is represented', () => {
    const everything = [
      project('a', 'analytics', ['Python']),
      project('b', 'analytics', ['SQL']),
      project('c', 'analytics', ['Tableau']),
      project('d', 'analytics', ['Jupyter']),
      project('e', 'analytics', ['TypeScript']),
    ];
    expect(emptyToolKeys(everything)).toEqual([]);
  });
});

describe('sphere facet', () => {
  // The map is the only place a sphere is authored, so these tests are the only
  // thing that can notice a new project slipping in without one — a chip set
  // would simply be missing it, and the board would still look whole.
  it('maps exactly the catalogue — no gap, no stale slug', () => {
    expect(Object.keys(PROJECT_SPHERES).sort()).toEqual([...PROJECT_ORDER].sort());
  });

  it('uses declared sphere keys only', () => {
    const declared = SPHERES.map(({ key }) => key);
    for (const [slug, sphere] of Object.entries(PROJECT_SPHERES)) {
      expect(declared, `${slug}: "${sphere}" is not a sphere`).toContain(sphere);
    }
  });

  it('splits the catalogue across spheres without losing a project', () => {
    const chips = projectSphereFilters(
      PROJECT_ORDER.map((slug) => ({ id: `${slug}.md` })),
    );
    expect(chips.map((chip) => chip.key)).toEqual([ALL_SPHERES, ...SPHERES.map(({ key }) => key)]);
    expect(chips[0].count).toBe(PROJECT_ORDER.length);
    expect(chips.slice(1).reduce((sum, chip) => sum + chip.count, 0)).toBe(PROJECT_ORDER.length);
  });

  it('localizes the chips', () => {
    const ru = projectSphereFilters([{ id: 'volta.md' }], 'ru');
    const en = projectSphereFilters([{ id: 'volta.md' }], 'en');
    expect(ru[0].label).toBe('Все сферы');
    expect(en[0].label).toBe('All spheres');
    expect(ru.map(({ label }) => label)).not.toEqual(en.map(({ label }) => label));
  });

  it('reads a slug with or without its extension', () => {
    expect(projectSphere('volta.md')).toBe('fintech');
    expect(projectSphere('volta')).toBe('fintech');
    expect(projectSphere('brand-new')).toBeUndefined();
  });

  it('matches an unmapped project only under "all"', () => {
    expect(matchesSphere(undefined, ALL_SPHERES)).toBe(true);
    expect(matchesSphere(undefined, 'fintech')).toBe(false);
    expect(matchesSphere('fintech', 'fintech')).toBe(true);
    expect(matchesSphere('fintech', 'tooling')).toBe(false);
  });
});

describe('sortSlugsByNewest', () => {
  const card = (slug: string, date?: string) => ({ slug, date });

  it('puts the newest date first', () => {
    expect(sortSlugsByNewest([card('a', '2025-06-19'), card('b', '2026-10-20')])).toEqual([
      'b',
      'a',
    ]);
  });

  it('keeps the curated order when dates tie', () => {
    // Four catalogue projects share 2026-08-11; a stable sort is what stops the
    // board reshuffling between builds.
    const tied = [card('volta', '2026-08-11'), card('sql', '2026-08-11'), card('site', '2026-08-11')];
    expect(sortSlugsByNewest(tied)).toEqual(['volta', 'sql', 'site']);
  });

  it('sinks a card with no date to the end', () => {
    expect(sortSlugsByNewest([card('undated'), card('old', '2025-06-19')])).toEqual([
      'old',
      'undated',
    ]);
  });

  it('does not mutate the input', () => {
    const input = [card('a', '2025-06-19'), card('b', '2026-10-20')];
    sortSlugsByNewest(input);
    expect(input.map((entry) => entry.slug)).toEqual(['a', 'b']);
  });
});

describe('ROLE_CURATION', () => {
  // The curation is data, and a test is what binds it: `PROJECT_ORDER` is a
  // plain `string[]`, so a slug typo in `ROLE_CURATION` would otherwise only
  // surface as a role landing that silently renders a shorter board.
  it('curates only slugs that exist in PROJECT_ORDER', () => {
    for (const role of AUDIENCES) {
      for (const slug of ROLE_CURATION[role]) {
        expect(PROJECT_ORDER, `${role}: "${slug}" is not a project`).toContain(slug);
      }
    }
  });

  it('never repeats a slug inside one role', () => {
    for (const role of AUDIENCES) {
      const slugs = ROLE_CURATION[role];
      expect(new Set(slugs).size, `${role}: duplicate slug`).toBe(slugs.length);
    }
  });

  it('keeps every project on every role landing — only the entry order differs', () => {
    // A role is an angle, not a filter (2026-10-11): nothing may be hidden. The
    // angle is the order a reader meets the work in (2026-10-20): a manager
    // starts at the cases with a result, a colleague at the method toolkits.
    // Both invariants are asserted here — reintroducing a subset turns the
    // first red, collapsing the orders back into one turns the second red.
    for (const role of AUDIENCES) {
      const curated = [...ROLE_CURATION[role]].sort();
      expect(curated, `${role} hides a project`).toEqual([...PROJECT_ORDER].sort());
    }
    expect(ROLE_CURATION.manager, 'manager and colleague read the same order').not.toEqual(
      ROLE_CURATION.colleague,
    );
  });

  it('gives every role a copy entry in both locales', () => {
    for (const lang of ['ru', 'en'] as const) {
      for (const role of AUDIENCES) {
        const copy = ROLE_COPY[lang][role];
        for (const key of ['title', 'description', 'h1'] as const) {
          expect(copy[key]?.length, `${lang}/${role}.${key} is empty`).toBeGreaterThan(0);
        }
      }
    }
  });

  // The pre-paint script in `Base.astro` picks which stored value to trust
  // before any module can run, so it cannot import `AUDIENCES` — it repeats the
  // three literals. This is the mechanism that keeps the copy honest.
  it('mirrors AUDIENCES in the Base.astro pre-paint script', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'src/layouts/Base.astro'), 'utf8');
    const from = source.indexOf('Prevent audience flash');
    const to = source.indexOf('</script>', from);
    expect(from, 'the audience script is gone from Base.astro').toBeGreaterThan(-1);
    const script = source.slice(from, to);

    for (const audience of AUDIENCES) {
      expect(script, `Base.astro does not accept "${audience}"`).toContain(`'${audience}'`);
    }
    expect(script, 'the default drifts from DEFAULT_AUDIENCE').toContain(
      `= '${DEFAULT_AUDIENCE}'`
    );
  });
});

describe('PROJECT_ORDER — the catalogue on disk', () => {
  // Closes the gap that let a content file exist without a PROJECT_ORDER entry:
  // `projectRank` sinks an unlisted slug to the end instead of throwing, so the
  // board still looked whole while the intended order silently lost a project.
  const onDisk = readdirSync(join(import.meta.dir, '../../src/content/projects'))
    .filter((file) => file.endsWith('.md') && !file.startsWith('_'))
    .map((file) => file.replace(/\.md$/, ''))
    .sort();

  it('lists exactly the RU content files — no gap, no stale slug', () => {
    expect([...PROJECT_ORDER].sort()).toEqual(onDisk);
  });

  it('carries no duplicate slug', () => {
    expect(new Set(PROJECT_ORDER).size).toBe(PROJECT_ORDER.length);
  });
});
