import { describe, it, expect } from 'bun:test';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEMO_CASE_OVERRIDES,
  DEMO_DESCRIPTION_OVERRIDES,
  attachCases,
  cleanDemoTitle,
  demoCaseMap,
  demoSlugFromFrontmatter,
  deriveTitle,
  groupDemos,
  parseDemoHead,
  scanDemos,
} from '../../src/lib/demos';

const ROOT = resolve(__dirname, '..', '..');

// The /demos/ hub is the first index these 25 boards have ever had, and every
// one of its claims is derived: the title from the board's own `<title>`, the
// case from project frontmatter. Derived means a regex or a join can silently
// return nothing, so each step is pinned here rather than trusted.

describe('parseDemoHead', () => {
  it('reads the board’s own title and description', () => {
    const head = parseDemoHead(
      '<html><head><title>A/B-тест: SRM, эффект и мощность</title>' +
        '<meta name="description" content="Интерактивный разбор A/B-теста."></head></html>',
    );
    expect(head).toEqual({
      title: 'A/B-тест: SRM, эффект и мощность',
      description: 'Интерактивный разбор A/B-теста.',
    });
  });

  it('accepts the reversed attribute order', () => {
    const head = parseDemoHead('<meta content="Доска с числами." name="description">');
    expect(head.description).toBe('Доска с числами.');
  });

  it('returns null, not an empty string, when a board ships neither', () => {
    expect(parseDemoHead('<html><body>generated</body></html>')).toEqual({
      title: null,
      description: null,
    });
  });

  it('decodes the entities a title/description can carry', () => {
    expect(parseDemoHead('<title>A &amp; B</title>').title).toBe('A & B');
  });
});

describe('titles', () => {
  it('strips a repository slug tail but keeps a real subtitle', () => {
    expect(cleanDemoTitle('MRR, воронка и удержание — sql-analytics-case-study')).toBe(
      'MRR, воронка и удержание',
    );
    expect(cleanDemoTitle('Volta Neobank — Product Analytics Portfolio')).toBe(
      'Volta Neobank — Product Analytics Portfolio',
    );
    // The tail test is case-sensitive on purpose: these two are product names,
    // not repository slugs, and a case-insensitive `[a-z0-9-]+` ate them.
    expect(cleanDemoTitle('PostHog: воронка, удержание, A/B-тест — TaskFlow')).toBe(
      'PostHog: воронка, удержание, A/B-тест — TaskFlow',
    );
    expect(cleanDemoTitle('Посты, форматы и что из этого следует — LinkedIn')).toBe(
      'Посты, форматы и что из этого следует — LinkedIn',
    );
  });

  it('falls back to a humanized slug only when the board has no title', () => {
    expect(deriveTitle('trino-federation')).toBe('Trino Federation');
  });
});

describe('demoSlugFromFrontmatter', () => {
  it('joins an in-repo board', () => {
    expect(demoSlugFromFrontmatter('demos/sql/index.html')).toBe('sql');
    expect(demoSlugFromFrontmatter('demos/volta/')).toBe('volta');
  });

  it('leaves /games/ out — the arcade is its own hub, not a /demos/ board', () => {
    // `src/content/projects/games.md` carries `demo: games/`; it is served by
    // `public/games/index.html`, which the nav and llms.txt already list.
    expect(demoSlugFromFrontmatter('games/')).toBe(null);
  });

  it('does not invent a slug for an externally hosted demo', () => {
    expect(demoSlugFromFrontmatter('https://nikitaboyarkin.github.io/delivery-control-tower/')).toBe(
      null,
    );
    expect(demoSlugFromFrontmatter(undefined)).toBe(null);
  });
});

describe('demoCaseMap', () => {
  const projects = [
    { id: 'ab.md', data: { demo: 'demos/ab/index.html', track: 'experiments', title: 'A/B' } },
    { id: 'sql.md', data: { demo: 'demos/sql/index.html', track: 'analytics', title: 'SQL' } },
    { id: 'delivery.md', data: { demo: 'https://example.com/', track: 'analytics', title: 'D' } },
    { id: 'volta.md', data: { demo: 'demos/volta/index.html', track: 'experiments', title: 'V' } },
    { id: 'clickhouse.md', data: { track: 'engineering', title: 'CH' } },
  ];

  it('takes the case from frontmatter and ignores an external pointer', () => {
    const cases = demoCaseMap(projects);
    expect(cases.sql).toEqual({ slug: 'sql', title: 'SQL', track: 'analytics' });
    expect(Object.values(cases).some((c) => c.slug === 'delivery')).toBe(false);
  });

  it('fills the boards no project points at, from the named override', () => {
    const cases = demoCaseMap(projects);
    expect(cases.bayesian).toEqual({ slug: 'ab', title: 'A/B', track: 'experiments' });
    expect(cases['trino-federation']).toEqual({
      slug: 'clickhouse',
      title: 'CH',
      track: 'engineering',
    });
    expect(cases['volta-board']).toEqual({ slug: 'volta', title: 'V', track: 'experiments' });
  });

  it('drops an override whose project does not exist instead of guessing', () => {
    // No `ab.md` in this fixture, so the `bayesian → ab` override has nowhere
    // to land and must vanish rather than point at a broken case URL.
    const cases = demoCaseMap(projects.filter((p) => p.id !== 'ab.md'));
    expect(cases.bayesian).toBeUndefined();
  });

  it('names only real project slugs, in both collections', () => {
    // The EN page joins `projects-en`; a slug present in only one collection
    // would silently demote its board to “Other” with no case link.
    for (const target of Object.values(DEMO_CASE_OVERRIDES)) {
      for (const collection of ['projects', 'projects-en']) {
        expect(existsSync(resolve(ROOT, 'src', 'content', collection, `${target}.md`))).toBe(true);
      }
    }
  });
});

describe('groupDemos', () => {
  const demo = (slug: string, track: string | null) => ({
    slug,
    title: slug,
    description: '',
    href: `demos/${slug}/`,
    caseSlug: track ? slug : null,
    caseTitle: null,
    track,
  });

  const groups = groupDemos([
    demo('churn', 'analytics'), // PROJECT_ORDER rank 14
    demo('cohort', 'analytics'), // rank 13
    demo('ab', 'experiments'), // rank 1
    demo('volta', 'experiments'), // rank 0
    demo('mystery', null),
  ]);

  it('orders tracks by the site taxonomy and puts unassigned boards last', () => {
    expect(groups.map((g) => g.key)).toEqual(['experiments', 'analytics', 'other']);
    expect(groups.at(-1)?.label).toBe('Прочее');
  });

  it('orders cards inside a track by the portfolio’s own PROJECT_ORDER', () => {
    expect(groups[0].demos.map((d) => d.slug)).toEqual(['volta', 'ab']);
    expect(groups[1].demos.map((d) => d.slug)).toEqual(['cohort', 'churn']);
  });

  it('localizes the other group', () => {
    expect(groupDemos([demo('x', null)], 'en').at(-1)?.label).toBe('Other');
  });
});

describe('scanDemos', () => {
  it('covers exactly the directories that serve an index.html, with a title and href each', () => {
    const onDisk = readdirSync(resolve(ROOT, 'public', 'demos'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .filter((entry) => existsSync(resolve(ROOT, 'public', 'demos', entry.name, 'index.html')))
      .map((entry) => entry.name)
      .sort();

    const scanned = scanDemos(resolve(ROOT, 'public', 'demos'));

    expect(scanned.map((d) => d.slug)).toEqual(onDisk);
    expect(scanned.length).toBeGreaterThan(20);
    for (const demo of scanned) {
      expect(demo.title.length).toBeGreaterThan(0);
      expect(demo.href).toBe(`demos/${demo.slug}/`);
    }
    // The one generated board without a meta description is covered by the
    // explicit override, so no card renders a blank body.
    for (const demo of scanned) expect(demo.description.length).toBeGreaterThan(0);
    expect(DEMO_DESCRIPTION_OVERRIDES['trino-federation']).toBeTruthy();
  });

  it('finds the same boards from the cwd-relative path the pages use', () => {
    // The pages call `scanDemos()` with no argument, i.e. `public/demos`
    // relative to the process cwd. Nothing else exercises that default, so a
    // build-time cwd change would ship an empty hub while the suites stay green.
    expect(scanDemos()).toEqual(scanDemos(resolve(ROOT, 'public', 'demos')));
  });

  it('returns nothing, not a throw, when the directory does not exist', () => {
    expect(scanDemos(resolve(ROOT, 'public', 'no-such-dir'))).toEqual([]);
  });
});

describe('attachCases', () => {
  it('keeps an unmatched board as null instead of assigning a case', () => {
    const [entry] = attachCases(
      [{ slug: 'mystery', title: 'M', description: 'd', href: 'demos/mystery/' }],
      {},
    );
    expect(entry.caseSlug).toBe(null);
    expect(entry.track).toBe(null);
  });
});
