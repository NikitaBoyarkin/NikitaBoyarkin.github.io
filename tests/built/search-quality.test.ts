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
    await page.keyboard.press('/');
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
});
