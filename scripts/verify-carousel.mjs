// Regression check for the horizontal card tracks (`src/lib/carousel.ts` +
// `CarouselNav.astro`).
//
// The failure a markup grep cannot see: the controls exist in the HTML but do
// nothing — because the track never became scrollable, because the module
// resolved the wrong element, or because `BlogFilter` swapped the list out from
// under it and the arrows kept pointing at the hidden one. All three are visual
// facts, so this drives a real browser against the build.
//
// What is a track: `/writing/` (both locales). The catalogue board
// (`/projects/`) is no longer one — it is a grid grouped by track, so its
// arrows, dots and sort checks moved to `verify-project-views.mjs`, which drives
// the lenses and the grouped grid. The role landings keep their own grid
// (curated sequences, not browse surfaces) and are out of scope here.
//
// Run against a served build (dist):
//   bun run serve-dist &                      # http://localhost:4321
//   bun run verify:carousel
// Or point BASE_URL anywhere:
//   BASE_URL=http://localhost:4330/ bun run verify:carousel
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const baseUrl = process.env.BASE_URL || 'http://localhost:4321/';
const SHOTS = process.env.SHOT_DIR || 'reports/carousel';

const failures = [];
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

const browser = await chromium.launch();
const errors = [];

async function open(width, height = 900) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return page;
}

const metrics = (page, selector) =>
  page.$eval(selector, (el) => ({
    display: getComputedStyle(el).display,
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    scrollLeft: el.scrollLeft,
    childWidths: Array.from(el.children).map((c) => Math.round(c.getBoundingClientRect().width)),
  }));

try {
  mkdirSync(SHOTS, { recursive: true });

  // ---- Articles: a track at every width -------------------------------
  for (const [label, url, width] of [
    ['ru desktop', 'writing/', 1440],
    ['ru phone', 'writing/', 390],
    ['en desktop', 'en/writing/', 1440],
    ['en phone', 'en/writing/', 390],
  ]) {
    const page = await open(width);
    await page.goto(`${baseUrl}${url}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(300);

    const track = await metrics(page, '#blog-list');
    check(`[${label}] track is a flex row`, track.display === 'flex', track.display);
    check(
      `[${label}] cards share one width`,
      new Set(track.childWidths).size === 1,
      `${[...new Set(track.childWidths)].join(', ')}px`,
    );

    const nav = page.locator('[data-carousel="articles"]');
    // `/en/writing/` holds two posts: at 1440px they fit, so the correct state
    // is a hidden nav, not a broken one. Everything below the branch assumes a
    // track that actually overflows.
    const overflow = track.scrollWidth > track.clientWidth + 1;
    console.log(`INFO  [${label}] row ${track.scrollWidth}px in ${track.clientWidth}px`);
    if (!overflow) {
      check(`[${label}] nav stays hidden when the row fits`, !(await nav.isVisible()));
      await page.screenshot({ path: `${SHOTS}/articles-${width}.png`, fullPage: false });
      await page.close();
      continue;
    }

    check(`[${label}] nav is visible`, await nav.isVisible());
    // WCAG 2.4.3 — the arrow must stay in the tab order at the start of the row.
    // A `disabled` button cannot take focus at all, so focus falls to <body> and
    // the reader is thrown to the top of the document.
    const prev = page.locator('[data-carousel="articles"] [data-carousel-prev]');
    check(
      `[${label}] prev is aria-disabled at the start`,
      (await prev.getAttribute('aria-disabled')) === 'true',
    );
    await prev.focus();
    check(
      `[${label}] prev keeps focus while aria-disabled`,
      await prev.evaluate((el) => document.activeElement === el),
    );

    const dots = await page.locator('[data-carousel="articles"] .carousel-dot').count();
    check(`[${label}] dots rendered`, dots > 0, `${dots} dots`);
    // WCAG 2.5.8 — the mark is 8px, the target must still be 24x24.
    const dotBox = await page.locator('[data-carousel="articles"] .carousel-dot').first().boundingBox();
    check(
      `[${label}] dot target is at least 24x24`,
      !!dotBox && dotBox.width >= 24 && dotBox.height >= 24,
      dotBox ? `${Math.round(dotBox.width)}x${Math.round(dotBox.height)}` : 'no box',
    );

    const before = track.scrollLeft;
    await page.locator('[data-carousel="articles"] [data-carousel-next]').click();
    await page.waitForTimeout(700);
    const after = await page.$eval('#blog-list', (el) => el.scrollLeft);
    check(`[${label}] next scrolls the track`, after > before, `${before} → ${after}`);
    // Snap has to land on a card edge, not mid-card: the card at the left edge
    // of the scrollport must be whole, not sliced by the viewport.
    const snapped = await page.$eval('#blog-list', (el) => {
      const box = el.getBoundingClientRect();
      const cards = Array.from(el.children);
      const atEdge = cards
        .map((c) => c.getBoundingClientRect())
        .filter((r) => r.left >= box.left - 1)
        .sort((a, b) => a.left - b.left)[0];
      return !atEdge || (atEdge.left >= box.left - 1 && atEdge.right <= box.right + 1);
    });
    check(`[${label}] snap lands on a whole card`, snapped);
    check(
      `[${label}] active dot follows the scroll`,
      (await page.locator('[data-carousel="articles"] .carousel-dot[aria-current="true"]').count()) === 1,
    );

    await page.screenshot({ path: `${SHOTS}/articles-${width}.png`, fullPage: false });
    await page.close();
  }

  // ---- Articles: the filter replaces the track -------------------------
  {
    const page = await open(1440);
    await page.goto(`${baseUrl}writing/`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.locator('.filter-tag[data-filter="guide"]').click();
    await page.waitForTimeout(400);

    const results = await metrics(page, '#blog-filter-results');
    check('[filter] filtered list is its own track', results.display === 'flex', results.display);
    const navTargetHidden = await page.$eval('#blog-list', (el) => el.hidden);
    check('[filter] static track is hidden', navTargetHidden);

    const overflow = results.scrollWidth > results.clientWidth + 1;
    const navVisible = await page.locator('[data-carousel="articles"]').isVisible();
    // Few results may not overflow: either way the nav must not point at the
    // hidden static list, which is what "visible while the track is absent" means.
    check(
      '[filter] nav follows the swapped track',
      overflow ? navVisible : !navVisible,
      overflow ? 'overflowing → visible' : 'fits → hidden',
    );
    if (overflow) {
      await page.locator('[data-carousel="articles"] [data-carousel-next]').click();
      await page.waitForTimeout(700);
      check(
        '[filter] next scrolls the swapped track',
        await page.$eval('#blog-filter-results', (el) => el.scrollLeft > 1),
      );
    }
    await page.close();
  }

  // ---- Role landing: a curated order has no sort control -----------------
  // `/manager/` renders 27 cards in a hand-picked sequence. The catalogue's
  // `?sort=` used to re-sort it track by track, scrambling the interleaving the
  // page exists to show, while "Reset order" sat there announcing a no-op.
  {
    const page = await open(1440);
    const order = () => page.$$eval('#project-list .project', (els) => els.map((el) => el.dataset.slug));
    await page.goto(`${baseUrl}manager/?sort=new`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(300);
    const sorted = await order();
    // Without this the three checks below pass on a 404: `[]` has no select, no
    // reset button, and compares equal to itself.
    check('[manager] the curated board rendered its cards', sorted.length > 0, `${sorted.length} cards`);
    check('[manager] no sort select on a curated board', (await page.locator('#board-sort').count()) === 0);
    check('[manager] no reset button on a curated board', (await page.locator('#board-reset').count()) === 0);
    // Ignoring `?sort=` is not enough: leaving it in the address bar promises a
    // control that is not on the page, and it survives a copy-paste.
    const search = await page.evaluate(() => location.search);
    check('[manager] the ignored ?sort= is stripped from the address', !/[?&]sort=/.test(search), search || 'no query');

    await page.goto(`${baseUrl}manager/`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(300);
    check('[manager] ?sort=new does not reorder the board', (await order()).join() === sorted.join());
    await page.close();
  }

  // ---- Contrast of the controls in both themes ------------------------
  // Lighthouse runs the runner's own `prefers-color-scheme`, so a control that
  // only fails in the light theme passes CI. Measure both here instead.
  for (const scheme of ['dark', 'light']) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 900 },
      colorScheme: scheme,
    });
    await page.goto(`${baseUrl}writing/`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(200);
    const ratios = await page.$eval('[data-carousel="articles"]', (nav) => {
      const parse = (c) => (c.match(/[\d.]+/g) || []).map(Number);
      const lum = ([r, g, b]) => {
        const f = (v) => {
          const x = v / 255;
          return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const ratio = (a, b) => {
        const [la, lb] = [lum(a), lum(b)];
        const [hi, lo] = la > lb ? [la, lb] : [lb, la];
        return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
      };
      // Walk up until something actually paints: the nav itself is transparent.
      const surfaceOf = (el) => {
        let node = el;
        while (node) {
          const c = getComputedStyle(node).backgroundColor;
          if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return parse(c);
          node = node.parentElement;
        }
        return parse(getComputedStyle(document.body).backgroundColor);
      };
      const dot = nav.querySelector('.carousel-dot[aria-current="true"]');
      const arrow = nav.querySelector('.carousel-arrow');
      const arrowStyle = getComputedStyle(arrow);
      return {
        // The glyph is what identifies the control (1.4.11); the circle behind
        // it is decoration.
        glyph: ratio(parse(arrowStyle.color), surfaceOf(arrow)),
        // The border is the control's boundary, so it answers to the page.
        border: ratio(parse(arrowStyle.borderTopColor), surfaceOf(nav)),
        dot: ratio(parse(getComputedStyle(dot).backgroundColor), surfaceOf(nav)),
      };
    });
    // WCAG 1.4.11 — non-text UI needs 3:1.
    check(`[${scheme}] arrow glyph contrast ≥ 3:1`, ratios.glyph >= 3, `${ratios.glyph}:1`);
    check(`[${scheme}] arrow border contrast ≥ 3:1`, ratios.border >= 3, `${ratios.border}:1`);
    check(`[${scheme}] active dot contrast ≥ 3:1`, ratios.dot >= 3, `${ratios.dot}:1`);
    await page.screenshot({ path: `${SHOTS}/articles-390-${scheme}.png` });
    await page.close();
  }

  check('no console or page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
}

console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
