// Dashboard contract.
//
// Three claims, in the order they can rot:
//   1. the card set and its order are frozen — adding or removing a card is a
//      deliberate edit in this file, never a side effect of a refactor;
//   2. every printed count is derived, not authored — the builder is fed
//      fixtures, so a literal smuggled into a component cannot survive here;
//   3. the scan over `public/` still finds every standalone app on disk.
//
// Claim 3 is the one worth the ink. The 23 demo apps and 20 diagram pages are in
// no sitemap, no JSON index and no navigation — `@astrojs/sitemap` sees only the
// routes Astro builds from `src/pages/`. If the scan silently returns fewer rows,
// nothing else in the suite goes red and those artefacts stay invisible.
import { describe, it, expect } from 'bun:test';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  CHILDREN_LIMIT,
  SECTION_ORDER,
  buildDashboard,
  countLabel,
  noun,
  sectionOrder,
  type ContentSectionId,
  type DashboardChild,
  type ScannedArtifacts,
  type SectionInput,
} from '../../src/lib/dashboard';
import { humanizeSlug, scanPublicArtifacts } from '../../src/lib/dashboard-scan';

const PUBLIC = join(__dirname, '..', '..', 'public');

// ---------------------------------------------------------------------------
// Fixtures — the builder must read every number from here.
// ---------------------------------------------------------------------------

const row = (n: number, kind: DashboardChild['kind'] = 'project'): DashboardChild => ({
  title: `Row ${n}`,
  href: `/row-${n}/`,
  kind,
});

const section = (count: number, rows: number): SectionInput => ({
  count,
  children: Array.from({ length: rows }, (_, i) => row(i)),
});

const scanned: ScannedArtifacts = {
  demos: [row(1, 'demo'), row(2, 'demo'), row(3, 'demo')],
  diagrams: [row(4, 'diagram'), row(5, 'diagram')],
  games: [{ title: 'Arcade', href: '/games/', kind: 'game', count: 7 }],
  audits: [row(6, 'audit')],
};

const fixture = (locale: 'ru' | 'en' = 'ru') => ({
  locale,
  generatedAt: '2026-01-01T00:00:00.000Z',
  sections: {
    projects: section(22, 9),
    volta: section(23, 2),
    writing: section(24, 4),
    glossary: section(27, 5),
    library: section(2, 2),
    topics: section(9, 3),
  } satisfies Record<ContentSectionId, SectionInput>,
  scanned,
});

// ---------------------------------------------------------------------------
// 1. The card set
// ---------------------------------------------------------------------------

describe('card set', () => {
  it('is frozen at eight cards, in order', () => {
    expect([...SECTION_ORDER]).toEqual([
      'projects',
      'volta',
      'writing',
      'glossary',
      'library',
      'topics',
      'tools',
      'about',
    ]);
  });

  it('drops the RU-only topics card from the EN dashboard and nowhere else', () => {
    expect(sectionOrder('ru')).toHaveLength(8);
    expect(sectionOrder('en')).toEqual([
      'projects',
      'volta',
      'writing',
      'glossary',
      'library',
      'tools',
      'about',
    ]);
  });

  it('emits the cards in the frozen order, in both locales', () => {
    for (const locale of ['ru', 'en'] as const) {
      expect(buildDashboard(fixture(locale)).sections.map((s) => s.id)).toEqual(sectionOrder(locale));
    }
  });

  it('gives every card a title and a description, and a reachable href when it has one', () => {
    for (const locale of ['ru', 'en'] as const) {
      for (const card of buildDashboard(fixture(locale)).sections) {
        expect(card.title.trim(), `${locale}/${card.id}: title`).not.toBe('');
        expect(card.desc.trim(), `${locale}/${card.id}: desc`).not.toBe('');
        if (card.href !== undefined) {
          expect(card.href.startsWith('/'), `${locale}/${card.id}: href ${card.href}`).toBe(true);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Counts are derived
// ---------------------------------------------------------------------------

describe('counts are derived', () => {
  it('prints the count it was handed, pluralised per locale', () => {
    const ru = buildDashboard(fixture('ru')).sections.find((s) => s.id === 'projects')!;
    expect(ru.count).toBe(22);
    expect(ru.countLabel).toBe('22 проекта');

    const en = buildDashboard(fixture('en')).sections.find((s) => s.id === 'projects')!;
    expect(en.count).toBe(22);
    expect(en.countLabel).toBe('22 projects');
  });

  it('clips a content card to CHILDREN_LIMIT because its index can take over', () => {
    const projects = buildDashboard(fixture()).sections.find((s) => s.id === 'projects')!;
    expect(projects.children).toHaveLength(CHILDREN_LIMIT);
    expect(projects.children.length).toBeLessThan(projects.count);
  });

  it('never clips the tools card — it is the only index the artefacts have', () => {
    const tools = buildDashboard(fixture()).sections.find((s) => s.id === 'tools')!;
    // 3 demos + 1 arcade row + 2 diagrams + 1 audit page.
    expect(tools.children).toHaveLength(7);
    expect(tools.children.filter((c) => c.kind === 'demo')).toHaveLength(3);
  });

  it('counts the tools card as apps, not as rows, and gives it no href', () => {
    const tools = buildDashboard(fixture()).sections.find((s) => s.id === 'tools')!;
    // 3 demos + 2 diagrams + 7 games behind the arcade row; the audit page is
    // navigation, not one of the advertised apps.
    expect(tools.count).toBe(12);
    expect(tools.children).toHaveLength(7);
    expect(tools.href).toBeUndefined();
  });

  it('pluralises the tools breakdown group by group', () => {
    const tools = buildDashboard(fixture('ru')).sections.find((s) => s.id === 'tools')!;
    // «2 диаграммы», never «2 диаграмм»: a single concatenated noun form is the
    // bug this assertion exists to catch.
    expect(tools.countLabel).toBe('3 демо · 2 диаграммы · 7 игр · 1 аудит');

    const en = buildDashboard(fixture('en')).sections.find((s) => s.id === 'tools')!;
    expect(en.countLabel).toBe('3 demos · 2 diagrams · 7 games · 1 audit');
  });

  it('builds six metrics whose every href is an anchor target', () => {
    const metrics = buildDashboard(fixture()).metrics;
    expect(metrics).toHaveLength(6);
    for (const metric of metrics) {
      expect(Number.isInteger(Number(metric.value)), `metric ${metric.value}`).toBe(true);
      expect(metric.label.trim()).not.toBe('');
      expect(metric.href.startsWith('/'), `metric href ${metric.href}`).toBe(true);
    }
  });
});

describe('noun', () => {
  const forms = { ru: ['проект', 'проекта', 'проектов'], en: ['project', 'projects'] } as const;

  it('takes the Russian three-form pattern, including the 11–14 exception', () => {
    expect(noun(1, 'ru', forms)).toBe('проект');
    expect(noun(2, 'ru', forms)).toBe('проекта');
    expect(noun(4, 'ru', forms)).toBe('проекта');
    expect(noun(5, 'ru', forms)).toBe('проектов');
    expect(noun(11, 'ru', forms)).toBe('проектов');
    expect(noun(12, 'ru', forms)).toBe('проектов');
    expect(noun(14, 'ru', forms)).toBe('проектов');
    expect(noun(21, 'ru', forms)).toBe('проект');
    expect(noun(22, 'ru', forms)).toBe('проекта');
    expect(noun(101, 'ru', forms)).toBe('проект');
  });

  it('takes the English two-form pattern', () => {
    expect(noun(1, 'en', forms)).toBe('project');
    expect(noun(0, 'en', forms)).toBe('projects');
    expect(noun(2, 'en', forms)).toBe('projects');
  });

  it('prefixes the count', () => {
    expect(countLabel(3, 'ru', { ru: ['игра', 'игры', 'игр'], en: ['game', 'games'] })).toBe(
      '3 игры',
    );
  });
});

// ---------------------------------------------------------------------------
// 3. The `public/` scan still finds every artefact on disk
// ---------------------------------------------------------------------------

const disk = {
  demos: readdirSync(join(PUBLIC, 'demos'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(PUBLIC, 'demos', entry.name, 'index.html')))
    .map((entry) => entry.name),
  diagrams: readdirSync(join(PUBLIC, 'diagrams')).filter((name) => name.endsWith('.html')),
  games: readdirSync(join(PUBLIC, 'games')).filter((name) => name.endsWith('.svg')),
  audits: readdirSync(join(PUBLIC, 'repo-audit')).filter((name) => name.endsWith('.html')),
};

/** Last path segment — the slug a row would fall back to if its `<title>` were gone. */
function slugFromHref(href: string): string {
  const segments = href.split('/').filter(Boolean);
  return segments[segments.length - 1].replace(/\.html$/, '');
}

describe('public/ scan', () => {
  const found = scanPublicArtifacts(PUBLIC);

  it('finds every demo app that has an entry point on disk', () => {
    expect(disk.demos).toHaveLength(24);
    expect(found.demos.map((d) => d.href).sort()).toEqual(
      disk.demos.map((name) => `/demos/${name}/`).sort(),
    );
  });

  it('finds every diagram page on disk', () => {
    expect(disk.diagrams).toHaveLength(20);
    expect(found.diagrams.map((d) => d.href).sort()).toEqual(
      disk.diagrams.map((name) => `/diagrams/${name}`).sort(),
    );
  });

  it('binds the single arcade row to the number of games on disk', () => {
    expect(found.games).toHaveLength(1);
    expect(found.games[0].href).toBe('/games/');
    expect(found.games[0].count).toBe(disk.games.length);
    expect(found.games[0].count).toBe(10);
  });

  it('finds both repo-audit pages, with the hub at its directory URL', () => {
    expect(found.audits).toHaveLength(disk.audits.length);
    expect(found.audits.map((a) => a.href).sort()).toEqual([
      '/repo-audit/',
      '/repo-audit/portfolio.html',
    ]);
  });

  it('marks every scanned row external — none of them is an Astro route', () => {
    for (const artefact of [...found.demos, ...found.diagrams, ...found.games, ...found.audits]) {
      expect(artefact.external, `${artefact.href}`).toBe(true);
    }
  });

  it('names every row from the artefact itself, never from a slug fallback', () => {
    const rows = [...found.demos, ...found.diagrams, ...found.games, ...found.audits];
    expect(rows.length).toBe(47);
    for (const artefact of rows) {
      expect(artefact.title.trim(), `${artefact.href}: title`).not.toBe('');
      // `humanizeSlug` is the fallback for a missing `<title>`. A row still
      // shaped like its slug means the artefact lost its own name.
      expect(artefact.title, `${artefact.href}: fell back to a slug`).not.toBe(
        humanizeSlug(slugFromHref(artefact.href)),
      );
    }
  });

  it('advertises the 54 interactive apps the dashboard promises', () => {
    const apps = found.demos.length + found.diagrams.length + found.games[0].count!;
    expect(apps).toBe(54);
  });

  it('renders the real numbers the plan froze, from the real scan', () => {
    const index = buildDashboard({ ...fixture('ru'), scanned: found });
    const tools = index.sections.find((s) => s.id === 'tools')!;
    expect(tools.count).toBe(54);
    expect(tools.countLabel).toBe('24 демо · 20 диаграмм · 10 игр · 2 аудита');
    expect(tools.children).toHaveLength(47);
    // 54 takes the Russian "few" form: «54 интерактивных приложения».
    const apps = index.metrics.find((m) => m.value === '54')!;
    expect(apps.label).toBe('интерактивных приложения');
  });
});

describe('the scan root', () => {
  it('fails loudly on a root that does not exist, instead of returning nothing', () => {
    // Silence is the failure mode that matters: an empty scan ships an empty
    // tools card, the build stays green, and only a build-output test looking at
    // `dist/` notices. The scan is the one place that can shout, so it does.
    expect(() => scanPublicArtifacts(join(PUBLIC, 'definitely-not-here'))).toThrow(
      /no such directory/,
    );
  });

  it('resolves a root that actually holds the artefacts', () => {
    // This is a smoke test, not the guard for the failure it looks like. Under
    // `bun test`, `import.meta.url` is the *source* path, so a module-relative
    // root resolves correctly here even though it resolves to `dist/public/`
    // once Astro bundles the module into `dist/.prerender/chunks/` — which is
    // how the first build of this feature died with every assertion above green.
    // The guard that actually catches it reads the built output:
    // `tests/built/dashboard.test.ts`.
    const found = scanPublicArtifacts();
    expect(found.demos.length).toBe(disk.demos.length);
    expect(found.diagrams.length).toBe(disk.diagrams.length);
    expect(found.games).toHaveLength(1);
    expect(found.audits.length).toBe(disk.audits.length);
  });
});
