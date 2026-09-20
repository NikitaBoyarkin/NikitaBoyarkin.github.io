import { describe, it, expect } from 'bun:test';
import {
  PROJECT_ORDER,
  ALL_TOOLS,
  emptyToolKeys,
  groupByTrack,
  matchesTool,
  projectToolFilters,
  sortByProjectOrder,
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
