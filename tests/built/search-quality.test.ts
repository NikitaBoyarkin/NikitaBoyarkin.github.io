// Search quality gates on the Pagefind index, plus the client wiring that
// feeds it.
//
//  1. Golden queries — 18 real searches with the page a visitor expects in the
//     top 3. A body that silently stops being indexed (a `data-pagefind-ignore`
//     creeping onto content, a template losing `searchType`) drops it out of
//     the top 3 and turns this red.
//  2. `ё` — Pagefind normalises it, so "учет" and "учёт" must agree. This is
//     the cheapest proof the RU stemmer is on.
//  3. Facets — `type` narrows to posts only; the Explorer handoff depends on it.
//  4. Client wiring — the box must actually reach Pagefind. On 2026-11-08 it did
//     not: `pagefindUrl` was never read from the DOM, the ReferenceError was
//     swallowed by `catch {}`, and every query fell back to title matching. The
//     index was fine the whole time, which is why the index-only assertions
//     below cannot catch it — hence the browser test.
//
// Requires `bun run build` first (reads dist/, including dist/pagefind).

import { describe, it, expect, beforeAll, afterAll, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { request } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Subprocess } from 'bun';

const ROOT = resolve(__dirname, '../..');
const DIST = resolve(ROOT, 'dist');
const PORT = 4600 + Math.floor(Math.random() * 300);
const BASE = `http://localhost:${PORT}`;

type PagefindResult = {
  results: Array<{
    data: () => Promise<{ url: string; filters: Record<string, string[]> }>;
  }>;
};
type Pagefind = {
  init?: () => Promise<void>;
  search: (q: string, opts?: Record<string, unknown>) => Promise<PagefindResult>;
};

let pf: Pagefind;

/** `file:/…/dist/posts/x/` and `/posts/x/` both become `/posts/x/`. */
function route(url: string): string {
  return url.replace(/^.*\/dist/, '');
}

/** `tests/preload.ts` installs happy-dom, which replaces global `fetch` with a
 *  CORS-enforcing shim and refuses same-host requests from a test file. Plain
 *  `node:http` is outside that shim. */
function httpGet(path: string): Promise<{ status: number; body: string }> {
  return new Promise((done, fail) => {
    const req = request(`${BASE}${path}`, { timeout: 2000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => done({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', fail);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.end();
  });
}

async function topRoutes(q: string, n = 3, opts?: Record<string, unknown>): Promise<string[]> {
  const found = await pf.search(q, opts);
  const slice = found.results.slice(0, n);
  return (await Promise.all(slice.map((r) => r.data()))).map((d) => route(d.url));
}

beforeAll(async () => {
  if (!existsSync(resolve(DIST, 'pagefind/pagefind.js'))) {
    throw new Error('dist/pagefind missing — run `bun run build` first');
  }
  pf = (await import(pathToFileURL(resolve(DIST, 'pagefind/pagefind.js')).href)) as Pagefind;
  await pf.init?.();
});

describe('golden queries (RU index)', () => {
  const GOLDEN: Array<[query: string, expected: string]> = [
    ['когорт', '/posts/cohort-retention-guide/'],
    ['когортный анализ', '/posts/cohort-retention-guide/'],
    ['удержание', '/glossary/retention-curve/'],
    ['retention', '/glossary/retention/'],
    ['churn', '/posts/churn-uplift-discount/'],
    ['отток', '/glossary/churn/'],
    ['LTV', '/posts/unit-economics-ltv/'],
    ['юнит-экономика', '/projects/volta/unit-economics/'],
    ['воронка', '/projects/volta/funnel/'],
    ['volta', '/projects/volta/churn/'],
    ['оконные функции', '/posts/sql-window-functions/'],
    ['streamlit', '/posts/streamlit-dashboard-prototype/'],
    ['github actions', '/posts/github-actions-automation/'],
    ['A/B тест', '/glossary/ab-test/'],
    ['платёжные отказы', '/posts/payment-failures-revenue/'],
    ['supabase', '/projects/supabase/'],
    ['airflow', '/projects/airflow/'],
    ['bayesian', '/posts/bayesian-ab-testing/'],
  ];

  for (const [query, expected] of GOLDEN) {
    it(`"${query}" puts ${expected} in the top 3`, async () => {
      const top = await topRoutes(query);
      expect(top).toContain(expected);
    });
  }

  it('ё is normalised: "учет" and "учёт" agree', async () => {
    const without = await topRoutes('учет', 5);
    const withYo = await topRoutes('учёт', 5);
    expect(without.length).toBeGreaterThan(0);
    expect(withYo).toEqual(without);
  });

  it('the type facet narrows to posts only', async () => {
    const routes = await topRoutes('retention', 8, { filters: { type: ['post'] } });
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((r) => r.startsWith('/posts/'))).toBe(true);
  });
});

// ── Index budget & shape ─────────────────────────────────────────────────
// `src/pages/search-index.json.ts` states the budget in a comment: the whole
// index is fetched on first focus, so `BODY_LIMIT = 600` keeps it under 1 MB.
// A comment is not a mechanism — these assertions are. They read only
// `dist/search-index.json` and the built pages it points at, so they need no
// browser and no Pagefind.
//
// The truncation checks exist because `bodyOf()` is supposed to cut on a word
// boundary (`slice(0, BODY_LIMIT).replace(/\s+\S*$/, "")`). Drop that
// `replace`, or raise `BODY_LIMIT`, and the haystack ships a half-word that
// Pagefind can never match — silently, since the index still parses.

const INDEX_FILE = resolve(DIST, 'search-index.json');
/** 1 MiB. The fetch happens on first focus of the search box. */
const INDEX_LIMIT_BYTES = 1024 * 1024;
/** Mirrors `BODY_LIMIT` in `src/pages/search-index.json.ts`. */
const BODY_CHAR_LIMIT = 600;

type SearchIndexEntry = {
  type: string;
  locale: string;
  href: string;
  title: string;
  desc: string;
  translit?: string;
  body?: string;
};

/** `…/dist/posts/x/index.html` ← `/posts/x/`. The leading slash is dropped so
 *  `resolve` cannot jump to the filesystem root. */
function distPage(href: string): string {
  return resolve(DIST, `${href.replace(/^\//, '')}index.html`);
}

/** Rendered text as a reader sees it: scripts and styles out, block boundaries
 *  kept as newlines, and no space inserted for inline tags (a word split by
 *  `<strong>` must stay one word). Entities become whitespace. */
function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(?:p|div|li|h[1-6]|tr|td|th|blockquote|section|article|figcaption)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ');
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The trailing token a mid-word cut leaves behind, or `null` when the body
 *  ends on a boundary.
 *
 *  Heuristic: a body ending in whitespace or punctuation is a boundary; a body
 *  ending in a word char is only a boundary if that last word appears on the
 *  page as a whole word. A cut fragment never does — it only ever shows up
 *  glued to the rest of the word it was sliced out of ("удержани" in
 *  "удержание"). */
function truncationFragment(body: string, text: string): string | null {
  const tail = /[\p{L}\p{N}]+$/u.exec(body);
  if (!tail) return null;
  const token = tail[0];
  const wholeWord = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(token)}(?![\\p{L}\\p{N}])`, 'u');
  return wholeWord.test(text) ? null : token;
}

describe('search index budget & shape', () => {
  let raw: string;
  let index: SearchIndexEntry[];

  beforeAll(async () => {
    const file = Bun.file(INDEX_FILE);
    if (!(await file.exists())) {
      throw new Error(`dist/search-index.json missing at ${INDEX_FILE} — run \`bun run build\` first`);
    }
    raw = await file.text();
    index = JSON.parse(raw) as SearchIndexEntry[];
    if (!Array.isArray(index) || index.length === 0) {
      throw new Error('dist/search-index.json is not a non-empty JSON array — rebuild with `bun run build`');
    }
  });

  it('is no thicker than 1 MB', () => {
    const bytes = Buffer.byteLength(raw, 'utf8');
    expect(
      bytes,
      `dist/search-index.json is ${bytes} bytes (${(bytes / 1024).toFixed(1)} KB, ${index.length} entries) — ` +
        'over the 1 MiB budget fetched on first focus; shrink BODY_LIMIT in src/pages/search-index.json.ts or drop entries',
    ).toBeLessThanOrEqual(INDEX_LIMIT_BYTES);
  });

  it('every entry carries a non-empty translit field', () => {
    // The field is what lets a Latin-keyboard query reach a Cyrillic entry;
    // an entry without it is simply unreachable that way.
    const offenders = index
      .filter((e) => typeof e.translit !== 'string' || e.translit.trim() === '')
      .map((e) => e.href);
    expect(
      offenders,
      `${offenders.length} of ${index.length} entries have no translit (missing or empty): ${offenders.slice(0, 10).join(', ')}`,
    ).toEqual([]);
  });

  it('no body exceeds 600 characters', () => {
    const lengths = index.map((e) => (e.body ?? '').length);
    const longest = Math.max(...lengths);
    const offenders = index
      .filter((e) => (e.body ?? '').length > BODY_CHAR_LIMIT)
      .map((e) => `${e.href} (${e.body!.length})`);
    expect(
      offenders,
      `${offenders.length} bodies exceed ${BODY_CHAR_LIMIT} chars (longest is ${longest} at ${index[lengths.indexOf(longest)]?.href}): ` +
        `${offenders.slice(0, 10).join(', ')} — BODY_LIMIT in src/pages/search-index.json.ts is the cap`,
    ).toEqual([]);
  });

  it('every body ends on a whole word, not a truncation fragment', async () => {
    const withBody = index.filter((e) => (e.body ?? '').length > 0);
    const checked: string[] = [];
    const offenders: string[] = [];

    for (const entry of withBody) {
      if (/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(entry.href)) continue; // external hub, no page in dist
      const page = Bun.file(distPage(entry.href));
      if (!(await page.exists())) {
        offenders.push(`${entry.href} (no built page to check against)`);
        continue;
      }
      checked.push(entry.href);
      const fragment = truncationFragment(entry.body!, pageText(await page.text()));
      if (fragment) offenders.push(`${entry.href} ends on "${fragment}"`);
    }

    // A floor, so a shrinking index cannot turn this test vacuous.
    expect(checked.length, `verified ${checked.length} of ${withBody.length} bodies against their built page`).toBeGreaterThan(
      50,
    );
    expect(
      offenders,
      `${offenders.length} bodies end mid-word: ${offenders.slice(0, 10).join(', ')} — ` +
        'the `\\s+\\S*$` trim in bodyOf() (src/pages/search-index.json.ts) was lost',
    ).toEqual([]);
  });

  it('the fragment heuristic itself: punctuation is a boundary, a cut is not', () => {
    // Self-check of the predicate above, so a heuristic that can never fire
    // cannot pass by accident.
    const page = 'Пайплайн читает события и считает удержание по когортам';
    expect(truncationFragment('Пайплайн читает события и считает удержание по', page)).toBeNull();
    expect(truncationFragment('Пайплайн читает события и считает удержание.', page)).toBeNull();
    expect(truncationFragment('Пайплайн читает события и считает удержани', page)).toBe('удержани');
  });
});

// ── Client wiring ────────────────────────────────────────────────────────
// Skipped rather than failed where no Chrome exists (CI runners), because the
// regression it guards is client-side and cannot be seen from the index alone.

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => existsSync(p));

let server: Subprocess | null = null;
let browser: import('playwright').Browser | null = null;

beforeAll(async () => {
  if (!CHROME) return;
  server = Bun.spawn(['bun', 'scripts/serve-dist.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdout: 'ignore',
    stderr: 'ignore',
  });
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const { status, body } = await httpGet('/__health');
      if (status === 200 && JSON.parse(body).root === DIST) break;
    } catch {
      /* not up yet */
    }
    await Bun.sleep(100);
  }
  // A different process squatting the port answers 404 for the index — this is
  // the second silent failure that made an earlier browser run lie.
  const js = await httpGet('/pagefind/pagefind.js');
  if (js.status !== 200) {
    throw new Error(`pagefind.js not served at ${BASE} (status ${js.status}) — port ${PORT} may be taken`);
  }
  browser = await (await import('playwright')).chromium.launch({ channel: 'chrome' });
}, 30_000);

afterAll(async () => {
  await browser?.close();
  server?.kill();
});

async function searchInUi(path: string, query: string, facet?: string): Promise<string[]> {
  const page = await browser!.newPage();
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    // On `/` the `/` shortcut belongs to the hero search now, so open the header
    // panel the way a pointer user would: drawer first, then its toggle. The
    // assertions below still guard the Pagefind wiring this test exists for.
    await page.locator('#nav-toggle').click();
    await page.locator('#search-toggle').click();
    await page.locator('input[type="search"]').first().fill(query);
    await page.waitForTimeout(1000);
    if (facet) {
      await page.locator(`[data-facet="${facet}"]`).click();
      await page.waitForTimeout(1000);
    }
    return await page.evaluate(() =>
      [...document.querySelectorAll('#search-results a')].map((a) => a.getAttribute('href') ?? ''),
    );
  } finally {
    await page.close();
  }
}

describe.skipIf(!CHROME)('client wiring (browser)', () => {
  it('reaches Pagefind instead of the title fallback', async () => {
    // The fallback returns one glossary row for "когорт"; the real engine
    // returns the post as well. One row is the fingerprint of the 2026-11-08 bug.
    const routes = await searchInUi('/', 'когорт');
    expect(routes.length).toBeGreaterThan(1);
    expect(routes.some((r) => r.startsWith('/posts/'))).toBe(true);
  }, 30_000);

  it('keeps an English query inside the English index', async () => {
    const routes = await searchInUi('/en/', 'retention');
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((r) => r.startsWith('/en/'))).toBe(true);
  }, 30_000);

  it('the facet button narrows results to posts', async () => {
    const routes = await searchInUi('/', 'retention', 'post');
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((r) => r.startsWith('/posts/'))).toBe(true);
  }, 30_000);

  it('the `/` shortcut focuses the hero search and leaves the drawer shut', async () => {
    const page = await browser!.newPage();
    try {
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
      await page.keyboard.press('/');
      await page.waitForTimeout(200);
      expect(await page.evaluate(() => document.activeElement?.id)).toBe('nt-input');
      expect(await page.evaluate(() => document.body.classList.contains('nav-open'))).toBe(false);
    } finally {
      await page.close();
    }
  }, 30_000);
});
