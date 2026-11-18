// Deep links into the nested case dashboard, in a real browser.
//
// `location.hash` is percent-encoded, so `#документация` arrives as `#%D0%B4…`.
// The controller keyed its anchor map on raw Cyrillic ids, so an undecoded hash
// matched nothing and the deep link silently fell back to the first panel. The
// bug was invisible to a static test and invisible for ASCII anchors
// (`#case-review`), which is why the only honest check drives the built page.
//
// Requires `bun run build` first (serves dist/).

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Subprocess } from 'bun';

const ROOT = resolve(__dirname, '../..');
const PORT = 4900 + Math.floor(Math.random() * 300);
const BASE = `http://localhost:${PORT}`;

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
      if ((await fetch(`${BASE}/projects/sql/`)).ok) break;
    } catch {
      /* not up yet */
    }
    await Bun.sleep(100);
  }
  browser = await (await import('playwright')).chromium.launch({ channel: 'chrome' });
}, 30_000);

afterAll(async () => {
  await browser?.close();
  server?.kill();
});

type Page = Awaited<ReturnType<import('playwright').Browser['newPage']>>;

const shownCasePanels = (page: Page): Promise<string[]> =>
  page.$$eval('.section-tabs--sm .section-panel', (els) =>
    els.filter((e) => !(e as HTMLElement).hidden).map((e) => (e as HTMLElement).dataset.panel ?? ''),
  );

const shownPagePanel = (page: Page): Promise<string | undefined> =>
  page.$eval('[data-rail-id] .section-panel:not([hidden])', (e) => (e as HTMLElement).dataset.panel);

describe.skipIf(!CHROME)('case dashboard deep links', () => {
  it('opens the first group without a hash, inside the case panel', async () => {
    const page = await browser!.newPage();
    try {
      await page.goto(`${BASE}/projects/sql/`, { waitUntil: 'load' });
      expect(await shownCasePanels(page)).toEqual(['case-context']);
      expect(await shownPagePanel(page)).toBe('case');
    } finally {
      await page.close();
    }
  });

  it('opens the group a Cyrillic heading id points into', async () => {
    // `#документация` is the id of the "Документация" H2 inside `case-docs`.
    const page = await browser!.newPage();
    try {
      await page.goto(`${BASE}/projects/sql/#документация`, { waitUntil: 'load' });
      expect(await shownCasePanels(page)).toEqual(['case-docs']);
    } finally {
      await page.close();
    }
  });

  it('still opens a group by its ASCII tab id', async () => {
    const page = await browser!.newPage();
    try {
      await page.goto(`${BASE}/projects/sql/#case-review`, { waitUntil: 'load' });
      expect(await shownCasePanels(page)).toEqual(['case-review']);
    } finally {
      await page.close();
    }
  });

  it('switches groups on a tab click', async () => {
    const page = await browser!.newPage();
    try {
      await page.goto(`${BASE}/projects/sql/`, { waitUntil: 'load' });
      await page.locator('#tab-case-result').click();
      expect(await shownCasePanels(page)).toEqual(['case-result']);
    } finally {
      await page.close();
    }
  });
});
