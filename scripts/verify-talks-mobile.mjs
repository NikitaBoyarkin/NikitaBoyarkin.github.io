// Regression gate for the Matemarketing 2026 programme graph on a phone
// (`/talks/`, `src/components/ProjectGraph.astro` + `src/lib/talks-graph.ts`).
//
// Lighthouse never sees this page: `/talks/` is absent from
// `.lighthouserc.json` → `ci.collect.url`, so the four failures below ship
// silently unless something drives the real build with a real finger. Each of
// them is a *gesture* fact no markup grep can see:
//
//   (a) a swipe that starts on the graph must still scroll the page — the card
//       is up to 480px tall, most of a phone screen, so a graph that owns the
//       surface traps the reader. This is `touch-action: none` vs the
//       `@media (pointer: coarse)` override, and it only exists as behaviour.
//   (b) a tap that drifts a couple of pixels must still follow the node's
//       anchor — Chrome kills navigation issued from a pointerup handler
//       inside a moving touch sequence, so activation has to be the anchor's
//       own compatibility click. Reproduced here with a 2.8px jitter.
//   (c) nothing on the page may widen the document at 320/390px.
//   (d) every graph node must offer a >=24px tap target (WCAG 2.5.8) — the
//       visible circle of a light node is ~10.6px, the pad is what counts.
//
// Touch is dispatched over CDP (`Input.dispatchTouchEvent`) rather than
// Playwright's high-level helpers: the gate needs a real touch sequence with
// control over every move, because the whole point is how the browser's own
// gesture recogniser arbitrates between panning the page and dragging a node.
//
// Run against a served build (dist):
//   bun run serve-dist &                      # http://localhost:4321
//   bun run verify:talks-mobile
// Or let this script serve the build itself (default: `dist/` on an ephemeral
// port), point it at another directory, or at any already-running server:
//   DIST_DIR=dist-mutated bun run verify:talks-mobile
//   BASE_URL=http://localhost:4330/ bun run verify:talks-mobile
// A browser pinned outside Playwright's cache works through CHROME_PATH.
import { chromium } from 'playwright';
import { existsSync, statSync } from 'node:fs';
import { extname, isAbsolute, join, normalize, sep } from 'node:path';
import { checkGraphLabelsAndTabs } from './talks-mobile-graph-checks.mjs';

const ROOT = join(import.meta.dir, '..');
const distArg = process.env.DIST_DIR || 'dist';
const DIST = isAbsolute(distArg) ? distArg : join(ROOT, distArg);
const PORT = Number(process.env.PORT ?? '0');
const PHONE = { width: 390, height: 844 };
const NARROW = { width: 320, height: 720 };
const MIN_TAP = 24;
const MIN_SCROLL = 100;

const failures = [];
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push({ name, detail });
}
const info = (message) => console.log(`INFO  ${message}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- The build under test ---------------------------------------------------
// Same static-file contract as scripts/serve-dist.mjs, but the directory is
// selectable and the port is ephemeral by default, so a mutation build can be
// served without stopping the real preview.
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.pdf': 'application/pdf',
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

function startServer() {
  if (!existsSync(join(DIST, 'talks', 'index.html'))) {
    throw new Error(`no talks page in ${DIST} — build the site first (bun run build)`);
  }
  const server = Bun.serve({
    port: PORT,
    fetch(req) {
      const file = resolveFile(new URL(req.url).pathname);
      if (!file) return new Response('Not found', { status: 404 });
      const type = MIME[extname(file).toLowerCase()];
      return new Response(Bun.file(file), type ? { headers: { 'content-type': type } } : {});
    },
  });
  return { server, baseUrl: `http://localhost:${server.port}/` };
}

let server = null;
let baseUrl = process.env.BASE_URL || '';
if (!baseUrl) {
  const started = startServer();
  server = started.server;
  baseUrl = started.baseUrl;
  info(`serving ${DIST} at ${baseUrl}`);
}

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
const pageErrors = [];

/** A phone: viewport, `isMobile` (layout viewport + no 300ms delay) and
 *  `hasTouch` — the last one is what flips `pointer: coarse`, the media query
 *  the touch-action override lives under. */
async function openPhone(viewport, path = 'talks/') {
  const page = await browser.newPage({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && pageErrors.push(m.text()));
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'load', timeout: 45000 });
  await page.waitForSelector('#talks-overview-svg a', { timeout: 15000 });
  return page;
}

/** The force layout settles on its own (~3 s at 13 nodes); every geometry
 *  check below has to read it after it stops moving, or a tap lands where the
 *  node used to be. Poll the node transforms until two samples agree. */
async function settle(page) {
  const sample = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('#talks-overview-svg a')]
        .map((a) => a.parentElement?.getAttribute('transform') || '')
        .join('|'),
    );
  let last = '';
  for (let i = 0; i < 24; i++) {
    await sleep(250);
    const now = await sample();
    if (now && now === last) return;
    last = now;
  }
  info('graph never stopped moving; measuring anyway');
}

/** One touch sequence over CDP. `touchEnd` with an empty point list lifts the
 *  last finger; every intermediate move is a separate browser input event, so
 *  the gesture recogniser sees a real drag rather than a teleport. */
async function touchDrag(cdp, points, { stepMs = 16 } = {}) {
  const [start] = points;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: start.x, y: start.y, id: 1 }],
  });
  for (let i = 1; i < points.length; i++) {
    const { x, y } = points[i];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
    await sleep(stepMs);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** A finger that lands, drifts `jitter` px and lifts: below the component's
 *  10px drag threshold, so it must stay a tap. */
async function touchTap(cdp, x, y, jitter = 2.8) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await sleep(30);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: x + jitter, y, id: 1 }],
  });
  await sleep(30);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

try {
  // --- Emulation precondition ----------------------------------------------
  // If `pointer: coarse` is not active the coarse-pointer branch is not being
  // exercised at all, and every PASS below would be meaningless.
  {
    const page = await openPhone(PHONE);
    const coarse = await page.evaluate(() => ({
      coarse: matchMedia('(pointer: coarse)').matches,
      touch: 'ontouchstart' in window,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    }));
    check(
      '[emulation] phone emulation puts the page under (pointer: coarse)',
      coarse.coarse && coarse.touch && coarse.innerWidth === PHONE.width,
      JSON.stringify(coarse),
    );
    await page.close();
  }

  // --- (d) tap targets ------------------------------------------------------
  {
    const page = await openPhone(PHONE);
    await settle(page);
    const pads = await page.evaluate(() =>
      [...document.querySelectorAll('#talks-overview-svg .pg-hit')]
        .map((c) => {
          const r = c.getBoundingClientRect();
          return { w: r.width, h: r.height, label: c.parentElement?.getAttribute('aria-label') || '' };
        })
        .filter((p) => p.w > 0 && p.h > 0),
    );
    const smallest = pads.reduce(
      (min, p) => (Math.min(p.w, p.h) < Math.min(min.w, min.h) ? p : min),
      pads[0] || { w: 0, h: 0, label: 'none' },
    );
    check(
      '[390px] every graph node offers a >=24px tap target',
      pads.length > 0 && smallest.w >= MIN_TAP && smallest.h >= MIN_TAP,
      `${smallest.w.toFixed(1)}×${smallest.h.toFixed(1)}px min over ${pads.length} node(s)` +
        (smallest.label ? ` — smallest: «${smallest.label}»` : ''),
    );
    await page.close();
  }

  // --- (a) a drag on the graph scrolls the page -----------------------------
  // Starts on a node's pad, the worst case: the finger lands on an interactive
  // target and still has to pan the document. Also asserts the drag does not
  // navigate — that is the click suppression after a real drag.
  {
    const page = await openPhone(PHONE);
    await settle(page);
    const cdp = await page.context().newCDPSession(page);

    // The graph sits below the fold; bring it up so the finger lands on the
    // graph itself. A swipe that starts outside the SVG proves nothing —
    // `touch-action` only governs the element actually under the finger.
    await page.evaluate(() =>
      document.querySelector('#talks-overview-svg').scrollIntoView({ block: 'center' }),
    );
    await sleep(600);

    const start = await page.evaluate(() => {
      const svg = document.querySelector('#talks-overview-svg');
      const box = svg.getBoundingClientRect();
      const pads = [...svg.querySelectorAll('.pg-hit')]
        .map((c) => c.getBoundingClientRect())
        .filter((r) => r.top > 70 && r.bottom < window.innerHeight - 20);
      const pad = pads.sort((a, b) => b.width - a.width)[0] || null;
      const x = pad ? pad.x + pad.width / 2 : box.x + box.width / 2;
      const y = pad
        ? pad.y + pad.height / 2
        : Math.max(box.top + 20, Math.min(box.bottom - 20, window.innerHeight / 2));
      const hit = document.elementFromPoint(x, y);
      return {
        x: Math.round(x),
        y: Math.round(y),
        onPad: !!pad,
        onGraph: !!hit && !!hit.closest('#talks-overview-svg'),
        hitTag: hit?.tagName || 'none',
        svg: `${Math.round(box.top)}..${Math.round(box.bottom)}`,
      };
    });
    check(
      '[390px] the drag starts on the graph surface',
      start.onGraph,
      `${start.onPad ? 'node pad' : 'centre'} ${start.x},${start.y} hit ${start.hitTag}; svg spans ${start.svg} in a ${PHONE.height}px viewport`,
    );

    const before = await page.evaluate(() => window.scrollY);
    const urlBefore = page.url();
    const travel = Math.min(240, start.y - 70);
    const points = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ x: start.x, y: start.y - travel * t }));
    await touchDrag(cdp, points, { stepMs: 20 });
    await sleep(500);

    const after = await page.evaluate(() => ({
      y: window.scrollY,
      url: location.href,
    }));
    const delta = after.y - before;
    check(
      '[390px] a vertical drag on the graph scrolls the page >100px',
      delta > MIN_SCROLL,
      `scrollY ${before} → ${after.y} (Δ${delta}px, need >${MIN_SCROLL}); swiped ${Math.round(travel)}px`,
    );
    check(
      '[390px] that drag does not navigate away',
      after.url === urlBefore,
      after.url === urlBefore ? urlBefore : `${urlBefore} → ${after.url}`,
    );
    await page.close();
  }

  // --- (b) a jittering tap opens a track ------------------------------------
  // `pointerdown → pointermove 2.8px → pointerup`, aimed at a track node. The
  // node's anchor points at `#track-<slug>`; landing there means the tap
  // became a real navigation (and the page-level dashboard opened the tracks
  // panel behind it).
  {
    const page = await openPhone(PHONE);
    await settle(page);
    const cdp = await page.context().newCDPSession(page);
    await page.evaluate(() => {
      window.__talksHashes = [];
      window.__talksPointers = [];
      window.addEventListener('hashchange', () => window.__talksHashes.push(location.hash));
      // Which element the finger actually reached: a tap that lands on the SVG
      // background instead of the node's anchor produces no navigation at all,
      // and the two failures look identical from the outside.
      for (const type of ['pointerdown', 'pointerup', 'click']) {
        document.addEventListener(
          type,
          (e) => {
            const el = e.target;
            const a = el?.closest?.('a');
            window.__talksPointers.push(`${type}:${a?.getAttribute('href') || el?.tagName || 'none'}`);
          },
          true,
        );
      }
    });

    const node = await page.evaluate(() => {
      const anchor = [...document.querySelectorAll('#talks-overview-svg a')].find((a) =>
        (a.getAttribute('href') || '').includes('#track-'),
      );
      if (!anchor) return null;
      const pad = anchor.querySelector('.pg-hit');
      const r = (pad || anchor).getBoundingClientRect();
      return {
        href: anchor.getAttribute('href'),
        label: anchor.getAttribute('aria-label'),
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
        size: r.width,
        inView: r.top > 0 && r.bottom < window.innerHeight,
      };
    });

    if (!node) {
      check('[390px] a jittering tap opens a track', false, 'no #track-* node in the overview graph');
    } else {
      // Bring it into the viewport without the tap landing outside it.
      if (!node.inView) {
        await page.evaluate((href) => {
          const a = [...document.querySelectorAll('#talks-overview-svg a')].find(
            (el) => el.getAttribute('href') === href,
          );
          a?.scrollIntoView({ block: 'center' });
        }, node.href);
        await sleep(600);
      }
      const box = await page.evaluate((href) => {
        const a = [...document.querySelectorAll('#talks-overview-svg a')].find(
          (el) => el.getAttribute('href') === href,
        );
        const pad = a?.querySelector('.pg-hit') || a;
        if (!pad) return null;
        const r = pad.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, node.href);

      if (!box) {
        check('[390px] a jittering tap opens a track', false, `node «${node.label}» vanished`);
      } else {
        info(`tapping «${node.label}» at ${box.x.toFixed(0)},${box.y.toFixed(0)} → ${node.href}`);
        // The pad is the tap target; whatever sits on top of its centre wins the
        // tap. Log it so a mis-aimed tap is not reported as a broken anchor.
        const under = await page.evaluate(({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          const a = el?.closest?.('a');
          return {
            tag: el?.tagName || 'none',
            href: a?.getAttribute('href') || null,
            label: a?.getAttribute('aria-label') || null,
          };
        }, box);
        if (under.href !== node.href) {
          info(`hit test at that point: ${JSON.stringify(under)}`);
        }
        await touchTap(cdp, box.x, box.y, 2.8);
        await page
          .waitForFunction(() => window.__talksHashes.length > 0, { timeout: 4000 })
          .catch(() => {});
        let result = null;
        try {
          result = await page.evaluate(() => ({
            hash: location.hash,
            path: location.pathname,
            events: window.__talksHashes || [],
            pointers: window.__talksPointers || [],
          }));
        } catch (e) {
          info(`tap navigated the document: ${page.url()} (${e.message.split('\n')[0]})`);
        }
        check(
          '[390px] a 2.8px jittering tap opens a track (#track-*)',
          !!result && result.events.length > 0 && /^#track-.+/.test(result.hash),
          result
            ? `hash «${result.hash || 'none'}», ${result.events.length} hashchange event(s) on ${result.path}` +
              `; finger reached ${result.pointers.join(', ') || 'nothing'}`
            : `no same-document navigation; landed on ${page.url()}`,
        );
      }
    }
    await page.close();
  }

  // --- (c) nothing widens the document -------------------------------------
  for (const viewport of [NARROW, PHONE]) {
    const page = await openPhone(viewport);
    await settle(page);
    const box = await page.evaluate(() => {
      const de = document.documentElement;
      return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth };
    });
    const overflow = box.scrollWidth - box.clientWidth;
    check(
      `[${viewport.width}px] the document is no wider than the viewport`,
      overflow === 0,
      `scrollWidth ${box.scrollWidth} − clientWidth ${box.clientWidth} = ${overflow}`,
    );
    await page.close();
  }

  // --- (d)(e)(f) labels, zoom controls, tab strips -------------------------
  // Extracted to a module of their own: these three checks are graph- and
  // tab-specific, and inlining them pushed this entry point past the repo's
  // file-size budget.
  await checkGraphLabelsAndTabs({ openPhone, settle, sleep, check, PHONE });

  check('no console or page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
  server?.stop(true);
}

console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
