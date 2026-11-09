// Behavioural smoke for the `/talks/` instrumentation («Граф докладов»).
//
// Proves the DOM state `TalksAnalytics.astro` and `ProjectGraph.astro` read
// actually moves — not that PostHog received anything: `Analytics.astro`
// refuses to init on localhost (`IS_LOCAL`), so `track()` can only buffer
// in-module here. Same shape as scripts/verify-talks-mobile.mjs.
//
// Run (build first):  bun run verify:talks-analytics
// Against a server:  BASE_URL=http://localhost:4321/ bun run verify:talks-analytics
import { chromium } from 'playwright';
import { existsSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DIST = join(ROOT, 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function resolveFile(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(DIST, p));
  const root = normalize(DIST) + sep;
  if (!file.startsWith(root) && file !== normalize(DIST)) return null;
  if (!existsSync(file) || !statSync(file).isFile()) return null;
  return file;
}

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
};

let server = null;
let baseUrl = process.env.BASE_URL || '';
if (!baseUrl) {
  if (!existsSync(join(DIST, 'talks', 'index.html'))) {
    throw new Error('no talks page in dist — run `bun run build` first');
  }
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const file = resolveFile(new URL(req.url).pathname);
      if (!file) return new Response('Not found', { status: 404 });
      const type = MIME[extname(file).toLowerCase()];
      return new Response(Bun.file(file), type ? { headers: { 'content-type': type } } : {});
    },
  });
  baseUrl = `http://localhost:${server.port}/`;
  console.log(`INFO  serving ${DIST} at ${baseUrl}`);
}

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
const analyticsRequests = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => m.type() === 'error' && pageErrors.push(m.text()));
page.on('request', (r) => {
  const host = new URL(r.url()).hostname;
  if (host.includes('posthog')) analyticsRequests.push(r.url());
});

try {
  await page.goto(`${baseUrl}talks/`, { waitUntil: 'load', timeout: 45000 });
  await page.waitForSelector('[data-section-tabs][data-analytics-group="talks"]', { timeout: 15000 });

  // --- (i) page-level tab switch moves `data-active` ------------------------
  const rootSel = '[data-section-tabs][data-analytics-group="talks"]';
  const before = await page.getAttribute(rootSel, 'data-active');
  const tabButton = page.locator(`${rootSel} [role="tab"][data-tab]`).nth(1);
  const tabLabel = (await tabButton.textContent()) || '';
  await tabButton.click();
  await page.waitForTimeout(250);
  const after = await page.getAttribute(rootSel, 'data-active');
  check(
    '(i) page-level tab click changes the root data-active',
    Boolean(before) && Boolean(after) && before !== after,
    `data-active ${JSON.stringify(before)} → ${JSON.stringify(after)} (clicked ${JSON.stringify(
      tabLabel.trim(),
    )})`,
  );

  // --- (ii) programme query filters rows below 91 ---------------------------
  const totalRows = await page.locator('.talks-row').count();
  await page.fill('#talks-query', 'ai');
  await page.waitForFunction(
    (total) => document.querySelectorAll('.talks-row:not([hidden])').length < total,
    totalRows,
    { timeout: 5000 },
  );
  const shownRows = await page.evaluate(
    () => document.querySelectorAll('.talks-row:not([hidden])').length,
  );
  check(
    '(ii) typing two characters filters programme rows below 91',
    totalRows === 91 && shownRows > 0 && shownRows < 91,
    `query "ai": ${shownRows} of ${totalRows} .talks-row visible (the observer counts [data-talk-day]:not([hidden]) separately)`,
  );

  // --- (iii) talk link opens the dialog with a title ------------------------
  const linkHref = await page.getAttribute('.talks-row:not([hidden]) a.talks-title', 'href');
  await page.click('.talks-row:not([hidden]) a.talks-title');
  await page.waitForFunction(() => document.getElementById('talk-card')?.open === true, null, {
    timeout: 5000,
  });
  const title = (await page.textContent('[data-talk-card-title]')) || '';
  const hashAfterOpen = await page.evaluate(() => location.hash);
  check(
    '(iii) talk link opens #talk-card with a non-empty title',
    title.trim().length > 0,
    `href ${JSON.stringify(linkHref)} → hash ${JSON.stringify(hashAfterOpen)}, title ${JSON.stringify(
      title.trim().slice(0, 60),
    )}`,
  );

  // --- (iv) dialog next moves to another talk -------------------------------
  const firstTitle = title.trim();
  await page.click('[data-talk-card-next]');
  await page.waitForFunction(
    (prev) => (document.querySelector('[data-talk-card-title]')?.textContent || '').trim() !== prev,
    firstTitle,
    { timeout: 5000 },
  );
  const nextTitle = ((await page.textContent('[data-talk-card-title]')) || '').trim();
  const hashAfterNext = await page.evaluate(() => location.hash);
  check(
    '(iv) dialog next button changes the title',
    nextTitle.length > 0 && nextTitle !== firstTitle,
    `hash ${JSON.stringify(hashAfterNext)}; title ${JSON.stringify(
      firstTitle.slice(0, 40),
    )} → ${JSON.stringify(nextTitle.slice(0, 40))}`,
  );

  // --- (v) Space on a graph node goes through the anchor's click path -------
  // Regression guard for ProjectGraph's Space handler: a direct `navigateTo`
  // would skip both `graph_node_click` and TalkCard's `talk_opened`. The
  // overview graph lives in the panel step (i) left behind, so re-open it.
  await page.click('[data-talk-card-close]');
  await page.locator(`${rootSel} [role="tab"][data-tab]`).first().click();
  const svgRoot = '#talks-overview-svg';
  await page.waitForSelector(`${svgRoot} a[href*="#track-"]`, { timeout: 15000 });
  const trackAnchor = page.locator(`${svgRoot} a[href*="#track-"]`).first();
  const targetHref = await trackAnchor.getAttribute('href');
  await trackAnchor.focus();
  await page.keyboard.press(' ');
  const spaceNavigated = await page
    .waitForFunction(() => location.hash.includes('track-'), null, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  const spaceHash = await page.evaluate(() => location.hash);
  check(
    '(v) Space on a graph node follows its anchor (hash moves to #track-*)',
    spaceNavigated && spaceHash.length > 1,
    `href ${JSON.stringify(targetHref)} → hash ${JSON.stringify(spaceHash)}`,
  );

  // --- observability of track() --------------------------------------------
  const ph = await page.evaluate(() => ({
    posthogGlobal: typeof window.posthog,
    loaded: Boolean(window.posthog && window.posthog.__loaded),
    hostname: location.hostname,
  }));
  check(
    '(e) no console/page errors during the smoke',
    pageErrors.length === 0,
    pageErrors.length ? pageErrors.join(' | ') : 'none',
  );
  console.log(
    `INFO  track() observability: window.posthog=${ph.posthogGlobal}, __loaded=${ph.loaded}, hostname=${ph.hostname}; posthog network requests=${analyticsRequests.length}`,
  );
} finally {
  await browser.close();
  if (server) server.stop(true);
}

console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
