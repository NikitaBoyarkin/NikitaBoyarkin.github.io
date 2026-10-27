// Regression check for the horizontal card tracks (`src/lib/carousel.ts` +
// `CarouselNav.astro`).
//
// The failure a markup grep cannot see: the controls exist in the HTML but do
// nothing — because the track never became scrollable, because the module
// resolved the wrong element, or because `BlogFilter` swapped the list out from
// under it and the arrows kept pointing at the hidden one. All three are visual
// facts, so this drives a real browser against the build.
//
// Both lists are tracks at every width. The catalogue board (`/projects/`) has
// no drag-reorder: `insertionAfter` picks the drop side from the vertical
// pointer position at one column, which in a horizontal row names the wrong
// neighbour, so the gesture was removed rather than half-fixed. The role
// landings keep their grid — they are curated sequences, not browse surfaces —
// and this script does not cover them.
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
    const prevDisabled = await page.locator('[data-carousel="articles"] [data-carousel-prev]').isDisabled();
    check(`[${label}] prev disabled at the start`, prevDisabled);

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

  // ---- Projects: a track at every width, no drag-reorder --------------
  for (const width of [780, 1440]) {
    const page = await open(width);
    await page.goto(`${baseUrl}projects/`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(300);

    const track = await metrics(page, '#project-list');
    const tag = `[projects ${width}]`;
    check(`${tag} board is a flex row`, track.display === 'flex', track.display);
    check(
      `${tag} board overflows`,
      track.scrollWidth > track.clientWidth + 1,
      `${track.scrollWidth} > ${track.clientWidth}`,
    );
    check(
      `${tag} cards share one width`,
      new Set(track.childWidths).size === 1,
      `${[...new Set(track.childWidths)].join(', ')}px`,
    );
    check(`${tag} nav is visible`, await page.locator('[data-carousel="projects"]').isVisible());

    // `0 20px 40px` reaches 40px below the card; less padding than that clips
    // the shadow along a hard line under the row.
    const padBottom = await page.$eval('#project-list', (el) => parseFloat(getComputedStyle(el).paddingBottom));
    check(`${tag} row leaves room for the hover shadow`, padBottom >= 40, `${padBottom}px`);

    const before = track.scrollLeft;
    await page.locator('[data-carousel="projects"] [data-carousel-next]').click();
    await page.waitForTimeout(700);
    const after = await page.$eval('#project-list', (el) => el.scrollLeft);
    check(`${tag} next scrolls the board`, after > before, `${before} → ${after}`);

    // The gesture is gone, not merely gated: no card may advertise a drag, or
    // the grip would promise one the board no longer answers.
    const drag = await page.$eval('#project-list .project', (el) => ({
      reorder: el.dataset.reorder ?? null,
      draggable: el.getAttribute('draggable'),
    }));
    check(`${tag} no card is reorderable`, drag.reorder === null, String(drag.reorder));
    check(`${tag} no card is natively draggable`, drag.draggable === null, String(drag.draggable));

    await page.screenshot({ path: `${SHOTS}/projects-${width}.png` });
    await page.close();
  }

  // ---- Projects: the sort select survives the drag removal ------------
  // `applySort` was rewritten when the gestures went: it used to restore a
  // dragged order from localStorage. Nothing writes that key now, so the check
  // is that "newest first" still re-sorts and "Reset order" still puts the
  // curated sequence back.
  {
    const page = await open(1440);
    await page.goto(`${baseUrl}projects/`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(200);
    const order = () => page.$$eval('#project-list .project', (els) => els.map((el) => el.dataset.slug));

    const curated = await order();
    await page.selectOption('#board-sort', 'new');
    await page.waitForTimeout(300);
    const byDate = await order();
    check('[projects sort] newest-first reorders the board', byDate.join() !== curated.join());
    // Per track, not across the board: the sort re-sorts inside each track and
    // the boards stay grouped, so a global descending check would fail by design.
    const outOfOrder = await page.$$eval('#project-list .project', (els) => {
      const byTrack = new Map();
      for (const el of els) {
        const key = el.dataset.track || '';
        if (!byTrack.has(key)) byTrack.set(key, []);
        byTrack.get(key).push(el.dataset.date || '');
      }
      return [...byTrack.values()].filter((dates) =>
        dates.some((d, i) => i > 0 && dates[i - 1] < d),
      ).length;
    });
    check('[projects sort] dates descend inside every track', outOfOrder === 0, `${outOfOrder} tracks out`);

    await page.click('#board-reset');
    await page.waitForTimeout(300);
    check('[projects sort] reset restores the curated order', (await order()).join() === curated.join());
    await page.close();
  }

  // ---- Projects phone: the dots retire, the position is spoken ----------
  // `/projects/` is 27 cards — far more than 12 pages at 390px. The dots
  // disappear there, and without the live region a screen-reader user has no
  // way to learn where in the row the arrows put them.
  {
    const page = await open(390);
    await page.goto(`${baseUrl}projects/`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(400);
    const state = await page.$eval('[data-carousel="projects"]', (nav) => {
      const dotsEl = nav.querySelector('[data-carousel-dots]');
      const live = nav.querySelector('[role="status"][aria-live]');
      return {
        hasDots: !!dotsEl,
        dotsHidden: dotsEl ? dotsEl.hidden : false,
        text: live ? live.textContent || '' : '',
      };
    });
    check('[projects 390] the dots container exists', state.hasDots);
    check('[projects 390] dots retire past twelve pages', state.dotsHidden);
    // Nothing the reader asked for has happened yet, so nothing is announced.
    check('[projects 390] no announcement on load', state.text === '', state.text || 'silent');
    await page.locator('[data-carousel="projects"] [data-carousel-next]').click();
    await page.waitForTimeout(700);
    const after = await page.$eval('[data-carousel="projects"] [role="status"]', (el) => el.textContent || '');
    check(
      '[projects 390] the page number is announced instead',
      /(Страница \d+ из \d+|Page \d+ of \d+)/.test(after),
      after || 'empty live region',
    );
    check('[projects 390] the announcement follows the scroll', after !== state.text, `${state.text} → ${after}`);
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
