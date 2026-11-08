// Regression check for the catalogue's four lenses (`src/components/ProjectViews.astro`
// + `ProjectTable.astro`, helpers in `src/lib/projects.ts`).
//
// The failures a markup grep cannot see, all of which this script caught once:
//   · the lens switch reveals a panel but the tablist/panels disagree about which
//     one (aria-selected says one thing, `hidden` another);
//   · the grouped board leaves a track heading standing over no cards once a
//     sphere facet empties that group;
//   · "newest first" re-sorts a group's cards out of their own section;
//   · the table's own scroller widens the document on a phone, because
//     `global.css` turns every `main table` into a block-level scroller.
// Driving the real build is the only way to see any of them.
//
// Run against a served build (dist):
//   bun run serve-dist &                      # http://localhost:4321
//   bun run verify:views
// Or point BASE_URL anywhere:
//   BASE_URL=http://localhost:4330/ bun run verify:views
// A browser pinned outside Playwright's cache (CI images, older installs) works
// through CHROME_PATH.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const baseUrl = process.env.BASE_URL || 'http://localhost:4321/';
const SHOTS = process.env.SHOT_DIR || 'reports/project-views';
const LENSES = ['tracks', 'real', 'fresh', 'table'];

const failures = [];
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
const errors = [];

async function open(width, lang = 'ru', search = '') {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const base = lang === 'en' ? 'en/projects/' : 'projects/';
  await page.goto(`${baseUrl}${base}${search}`, { waitUntil: 'networkidle' });
  return page;
}

const state = (page) =>
  page.evaluate(() => ({
    active: document.querySelector('[data-project-views]')?.getAttribute('data-active-view'),
    visible: [...document.querySelectorAll('.pview-panel')]
      .filter((p) => !p.hidden)
      .map((p) => p.dataset.panel),
    selected: [...document.querySelectorAll('[role="tab"]')]
      .filter((t) => t.getAttribute('aria-selected') === 'true')
      .map((t) => t.dataset.view),
    docWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

try {
  // --- Default lens: the board, unchanged ------------------------------------
  {
    const page = await open(1280);
    const s = await state(page);
    check('default lens is the board', s.active === 'tracks' && s.visible.join() === 'tracks');
    check('one tab selected, and it is the same lens', s.selected.join() === 'tracks');

    // --- Cold load on a non-default lens, then back to the board ------------
    await page.goto(`${baseUrl}projects/?view=table`, { waitUntil: 'networkidle' });
    const table = await state(page);
    check('?view=table opens the table', table.active === 'table' && table.visible.join() === 'table');

    await page.getByRole('tab', { name: 'По трекам' }).click();
    await page.waitForTimeout(300);
    const back = await page.evaluate(() => ({
      search: location.search,
      groups: [...document.querySelectorAll('.project-group')].map((g) => ({
        key: g.dataset.group,
        cards: g.querySelectorAll('.project').length,
      })),
    }));
    check('the default lens leaves no ?view= in the URL', back.search === '', back.search);
    // The Bases `groupBy`: four sections, 6/15/3/7, summing to the catalogue.
    check(
      'the board is grouped by track, and the groups hold every case',
      back.groups.map((g) => `${g.key}:${g.cards}`).join(' ') ===
        'experiments:6 analytics:15 product:3 engineering:7',
      back.groups.map((g) => `${g.key}:${g.cards}`).join(' '),
    );

    // --- Keyboard: roving tabindex + arrow keys ------------------------------
    await page.getByRole('tab', { name: 'По трекам' }).focus();
    await page.keyboard.press('ArrowRight');
    const kbd = await page.evaluate(() => ({
      active: document.querySelector('[data-project-views]')?.getAttribute('data-active-view'),
      focused: document.activeElement?.dataset?.view,
      search: location.search,
    }));
    check(
      'ArrowRight moves to the next lens, keeps focus, writes ?view=',
      kbd.active === 'real' && kbd.focused === 'real' && kbd.search === '?view=real',
      JSON.stringify(kbd),
    );

    // --- The board's own controls still work inside the lens -----------------
    await page.getByRole('tab', { name: 'По трекам' }).click();
    await page.waitForTimeout(200);
    await page.locator('[data-panel="tracks"] [data-track-filter="product"]').click();
    await page.waitForTimeout(250);
    const filtered = await page.evaluate(() => ({
      hash: location.hash,
      shown: [...document.querySelectorAll('.project-group')].filter((g) => !g.classList.contains('is-hidden'))
        .map((g) => g.dataset.group),
      visible: [...document.querySelectorAll('[data-panel="tracks"] .project')].filter(
        (c) => !c.classList.contains('is-hidden'),
      ).length,
    }));
    check(
      'a track chip isolates one group and hides the rest',
      filtered.hash === '#track-product' && filtered.shown.join() === 'product' && filtered.visible === 3,
      JSON.stringify(filtered),
    );

    // A sphere facet cuts across groups; a group left with no card must go too.
    await page.locator('[data-track-filter="all"]').click();
    await page.waitForTimeout(200);
    await page.click('[aria-controls="project-more-filters"]');
    await page.waitForTimeout(150);
    await page.locator('[data-sphere-filter="fintech"]').click();
    await page.waitForTimeout(250);
    const sphere = await page.evaluate(() => ({
      shown: [...document.querySelectorAll('.project-group')]
        .filter((g) => !g.classList.contains('is-hidden'))
        .map((g) => g.dataset.group),
      emptyHeading: [...document.querySelectorAll('.project-group')].some(
        (g) =>
          !g.classList.contains('is-hidden') &&
          ![...g.querySelectorAll('.project')].some((c) => !c.classList.contains('is-hidden')),
      ),
    }));
    check(
      'a sphere facet hides groups that it empties',
      !sphere.emptyHeading && sphere.shown.length > 0 && sphere.shown.length < 4,
      JSON.stringify(sphere),
    );

    // --- Sort inside each group, and the reset back to the curated order ----
    await page.locator('[data-sphere-filter="all"]').click();
    await page.waitForTimeout(200);
    const order = () =>
      page.evaluate(() =>
        Object.fromEntries(
          [...document.querySelectorAll('.project-group')].map((g) => [
            g.dataset.group,
            [...g.querySelectorAll('.project')].map((c) => c.dataset.date),
          ]),
        ),
      );
    const curated = await order();
    await page.selectOption('#board-sort', 'new');
    await page.waitForTimeout(250);
    const sorted = await order();
    const descending = (dates) => dates.every((d, i) => i === 0 || dates[i - 1] >= d);
    check(
      'newest-first re-sorts inside every group, and never across them',
      JSON.stringify(sorted) !== JSON.stringify(curated) &&
        Object.values(sorted).every(descending) &&
        Object.keys(sorted).every((k) => sorted[k].length === curated[k].length),
    );
    await page.click('#board-reset');
    await page.waitForTimeout(250);
    check(
      'reset restores the curated order',
      JSON.stringify(await order()) === JSON.stringify(curated),
    );

    await page.screenshot({ path: `${SHOTS}/desktop-board.png` });
    await page.close();
  }

  // --- Table contents, both locales ----------------------------------------
  for (const lang of ['ru', 'en']) {
    const page = await open(1280, lang, '?view=table');
    const table = await page.evaluate(() => {
      const scope = document.querySelector('[data-panel="table"]');
      return {
        headers: [...scope.querySelectorAll('th[scope="col"]')].map((th) => th.textContent.trim()),
        rows: scope.querySelectorAll('tbody tr').length,
        caseLinks: scope.querySelectorAll('tbody a[data-analytics-project]').length,
        badges: scope.querySelectorAll('.project-dataset-badge').length,
        labelled: scope.querySelector('.pview-tab')?.textContent ?? '',
      };
    });
    check(`[${lang}] table has the eight columns`, table.headers.length === 8, table.headers.join(' · '));
    check(`[${lang}] table lists every case`, table.rows === 31 && table.caseLinks === 31, `${table.rows} rows`);
    check(`[${lang}] provenance badge only where it is the exception`, table.badges === 3, `${table.badges}`);
    await page.screenshot({ path: `${SHOTS}/table-${lang}.png` });
    await page.close();
  }

  // --- Phone: no lens may widen the document -------------------------------
  for (const lens of LENSES) {
    const page = await open(375, 'ru', `?view=${lens}`);
    const s = await state(page);
    check(
      `[375px] ${lens} keeps the document at viewport width`,
      s.docWidth === s.innerWidth,
      `${s.docWidth} vs ${s.innerWidth}`,
    );
    if (lens === 'table') {
      const scrolls = await page.evaluate(() => {
        const w = document.querySelector('.project-table-scroll');
        return w.scrollWidth > w.clientWidth;
      });
      check('[375px] the table scrolls inside its own region', scrolls);
    }
    await page.screenshot({ path: `${SHOTS}/phone-${lens}.png` });
    await page.close();
  }

  check('no console or page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
}

console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
