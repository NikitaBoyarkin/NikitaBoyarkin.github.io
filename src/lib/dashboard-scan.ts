// Build-time scan of `public/` — the only way the standalone apps reach an index.
//
// Why it has to exist: `@astrojs/sitemap` enumerates only the routes Astro builds
// from `src/pages/`, so everything served verbatim from `public/` is absent from
// `sitemap-0.xml`; `explorer-index.json` reads content collections and is blind to
// it as well. Nothing in the site's navigation links the 23 demo apps or the 20
// diagram pages today — this dashboard is the first index either has ever had.
//
// Titles are read from each artefact's own `<title>`, so nothing is invented: an
// app names itself. They are deliberately not translated — these are
// language-neutral static files with no EN twin, and reporting that asymmetry is
// honest where fabricating an English name would not be.
//
// Build-only: imports `node:fs`. Never import this from a client script — the
// pure half is `lib/dashboard.ts`.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { withBase } from './path';
import type { DashboardChild, ScannedArtifacts } from './dashboard';

/**
 * `<root>/public`, resolved from the process cwd — deliberately NOT from
 * `import.meta.url`. Astro bundles this module into `dist/.prerender/chunks/`,
 * where `new URL('../../public/', import.meta.url)` resolves to `dist/public/`;
 * the scan then finds nothing and the build dies on the empty arcade row. The
 * build runs from the project root (`package.json` scripts), so the cwd is the
 * reliable base. `tests/lib/dashboard.test.ts` pins this by calling
 * `scanPublicArtifacts()` with no argument.
 */
export const PUBLIC_DIR = join(process.cwd(), 'public');

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
  '&mdash;': '—',
  '&ndash;': '–',
  '&middot;': '·',
};

function decodeEntities(text: string): string {
  return text.replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity);
}

/** The artefact's own name. `null` when the file carries no usable `<title>`. */
export function htmlTitle(file: string): string | null {
  let html: string;
  try {
    html = readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const match = html.match(/<title>([^<]*)<\/title>/i);
  if (!match) return null;
  const title = decodeEntities(match[1]).replace(/\s+/g, ' ').trim();
  return title.length > 0 ? title : null;
}

/**
 * Fallback when an artefact has no `<title>`: `serp-rank` → `Serp rank`. Better
 * a rough slug-derived name than a dropped row — a missing artefact is the one
 * outcome this scan exists to prevent. The contract test asserts that no scanned
 * row currently needs it.
 */
export function humanizeSlug(slug: string): string {
  const words = slug.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function child(
  file: string,
  href: string,
  kind: DashboardChild['kind'],
  fallbackSlug: string,
): DashboardChild {
  return {
    title: htmlTitle(file) ?? humanizeSlug(fallbackSlug),
    href,
    kind,
    external: true,
  };
}

function subdirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function files(dir: string, extension: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

/** Newest-first is meaningless here, so rows are ordered by their own names. */
function byTitle(rows: DashboardChild[]): DashboardChild[] {
  return [...rows].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
}

export function scanPublicArtifacts(publicDir: string = PUBLIC_DIR): ScannedArtifacts {
  // Loud on a wrong root, quiet on an empty category. A missing `public/` is
  // never legitimate — it means the path was derived from something that moved
  // (this module gets bundled into `dist/.prerender/chunks/`), and without this
  // check the scan returns zero rows and the dashboard silently ships an empty
  // tools card. An existing `public/` with no diagrams is a different thing and
  // is allowed to be empty.
  if (!existsSync(publicDir)) {
    throw new Error(
      `dashboard scan: no such directory: ${publicDir}. Pass the project's public/ root — ` +
        'do not derive it from import.meta.url, which points into dist/ after bundling.',
    );
  }

  const demosDir = join(publicDir, 'demos');
  const demos = byTitle(
    subdirs(demosDir)
      // An app is a directory with an entry point. `demos/` also holds shared
      // assets (`demo.css`, `demo-theme.js`), which the directory-only filter
      // already excludes, but a stray directory without a page must not become a
      // dead card either.
      .filter((name) => existsSync(join(demosDir, name, 'index.html')))
      .map((name) => child(join(demosDir, name, 'index.html'), withBase(`demos/${name}/`), 'demo', name)),
  );

  const diagramsDir = join(publicDir, 'diagrams');
  const diagrams = byTitle(
    files(diagramsDir, '.html').map((name) =>
      child(join(diagramsDir, name), withBase(`diagrams/${name}`), 'diagram', name.replace(/\.html$/, '')),
    ),
  );

  // The arcade is one page with N games behind it, so it is one row: the 10 SVG
  // games are not individually addressable pages.
  const gamesDir = join(publicDir, 'games');
  const gameCount = files(gamesDir, '.svg').length;
  const games: DashboardChild[] =
    gameCount > 0
      ? [
          {
            ...child(join(gamesDir, 'index.html'), withBase('games/'), 'game', 'games'),
            count: gameCount,
          },
        ]
      : [];

  const auditDir = join(publicDir, 'repo-audit');
  const audits = byTitle(
    files(auditDir, '.html').map((name) =>
      child(
        join(auditDir, name),
        // `index.html` is the directory URL; `portfolio.html` is its own page.
        name === 'index.html' ? withBase('repo-audit/') : withBase(`repo-audit/${name}`),
        'audit',
        name.replace(/\.html$/, ''),
      ),
    ),
  );

  return { demos, diagrams, games, audits };
}
