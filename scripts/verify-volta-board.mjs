// Regression check for the Volta board's tabs (`public/demos/volta-board/`,
// folded into one page by `scripts/build-volta-board.mjs`).
//
// The defect this exists for: a static dbt-charts export carries ONE tab and
// links the rest to `?…_tab_<board>=<tab>`, which only a `dct serve` host
// answers. On Pages a click reloaded the same tab, so "переключение вида" did
// nothing and the board shipped 2 charts of 20. Everything below is what that
// looked like from the outside — and what a markup grep cannot see:
//
//   · a click switches the visible pane AND the URL, and neither drifts from
//     the other;
//   · the case page's embedded frame re-fits its height after the tab changes
//     (a fixed-height frame would cut the KYC tab in half);
//   · the charts a tab draws are its own — ONBOARDING opens with 2, KYC with 9;
//   · the merged page raises no console error, i.e. the deduped font/style
//     block still resolves for the panes that had theirs dropped.
//
// Run against a served build (dist):
//   bun run serve-dist &                      # http://localhost:4321
//   bun run verify:volta-board
// Or point BASE_URL anywhere:
//   BASE_URL=http://localhost:4330/ bun run verify:volta-board
// A browser pinned outside Playwright's cache works through CHROME_PATH.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const baseUrl = process.env.BASE_URL || 'http://localhost:4321/';
const SHOTS = process.env.SHOT_DIR || 'reports/volta-board';
const BOARD = 'demos/volta-board/';
const CASE = 'projects/volta/';

/** Pane key → how many charts that tab draws, as `dct describe` counts them. */
const TABS = {
  onboarding: 2,
  kyc_ab_test: 9,
  retention: 3,
  causal_did: 2,
  segmentation: 4,
};

const failures = [];
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);

async function open(path, width, height = 900) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
  return { page, errors };
}

/** What the reader can see: the open pane, its chart count, the URL. */
const state = (page) =>
  page.evaluate(() => {
    const panes = [...document.querySelectorAll('[data-dbt-tab-pane]')];
    const visible = panes.filter((pane) => getComputedStyle(pane).display !== 'none');
    return {
      panes: panes.length,
      visible: visible.map((pane) => pane.dataset.dbtTabPane),
      charts: visible.reduce((total, pane) => total + pane.querySelectorAll('[data-chart-id]').length, 0),
      search: window.location.search,
    };
  });

async function clickTab(page, label) {
  const anchor = page.locator('[data-dbt-tab-pane].dbt-tab-active a[href*="tab="]').filter({ hasText: label });
  await anchor.first().click({ force: true });
  await page.waitForTimeout(400);
}

// ── The board on its own URL ────────────────────────────────────────────────
{
  const { page, errors } = await open(BOARD, 1280);
  const first = await state(page);
  check('board opens on one tab, not on a stack of five', first.panes === 5 && first.visible.length === 1, `panes=${first.panes} visible=${first.visible}`);
  check('the open tab is the board default', first.visible[0] === 'onboarding', first.visible[0]);
  check('the open tab draws its own charts', first.charts === TABS.onboarding, `${first.charts} charts`);
  await page.screenshot({ path: `${SHOTS}/board-onboarding.png` });

  for (const [key, charts] of Object.entries(TABS)) {
    if (key === 'onboarding') continue;
    const label = await page.evaluate(
      ([wanted]) => {
        const pane = document.querySelector('[data-dbt-tab-pane].dbt-tab-active');
        const anchor = [...pane.querySelectorAll('a[href*="tab="]')].find((a) =>
          a.getAttribute('href').includes(`tab=${wanted}`),
        );
        return anchor ? anchor.textContent.trim() : '';
      },
      [key],
    );
    await clickTab(page, label);
    const after = await state(page);
    check(`clicking "${label}" opens ${key}`, after.visible.length === 1 && after.visible[0] === key, after.visible.join(','));
    check(`${key} draws its own charts`, after.charts === charts, `${after.charts} charts, expected ${charts}`);
    check(`${key} is in the URL`, after.search === `?tab=${key}`, after.search || '(empty)');
    await page.screenshot({ path: `${SHOTS}/board-${key}.png` });
  }

  const { page: deep } = await open(`${BOARD}?tab=segmentation`, 1280);
  const linked = await state(deep);
  check('a ?tab= deep link opens that tab', linked.visible[0] === 'segmentation', linked.visible.join(','));

  // Phones get the same switch: the tab bar is inside the SVG, so it does not
  // depend on the phone breakpoints the way the site's own tab strips do.
  const { page: phone } = await open(BOARD, 390, 780);
  const phoneFirst = await state(phone);
  check('a phone opens one tab, fitted to the frame', phoneFirst.visible.length === 1, phoneFirst.visible.join(','));

  check('the board raises no console error', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
  await deep.close();
  await phone.close();
}

// ── The board as the case page embeds it ────────────────────────────────────
{
  const { page, errors } = await open(CASE, 1280);
  // The board lives in the case's "Ещё" section panel; a frame inside a hidden
  // panel measures 0 until its tab is opened.
  const panelId = await page.evaluate(() => {
    const frame = [...document.querySelectorAll('iframe')].find((el) => (el.getAttribute('src') || '').includes('volta-board'));
    const panel = frame?.closest('[hidden]');
    return panel ? panel.id : null;
  });
  check('the case page frames the board', panelId !== null, panelId || 'no hidden panel found');
  if (panelId) {
    await page.locator(`[role="tab"][aria-controls="${panelId}"]`).click();
    await page.waitForTimeout(2500);
  }

  const frameEl = page.locator('iframe[src*="volta-board"]');
  const frame = page.frames().find((candidate) => candidate.url().includes('volta-board'));
  const before = await frameEl.evaluate((el) => el.style.height);
  const opened = await state(frame);
  check('the embedded board opens on its default tab', opened.visible[0] === 'onboarding', opened.visible.join(','));

  const label = await frame.evaluate(() => {
    const pane = document.querySelector('[data-dbt-tab-pane].dbt-tab-active');
    const anchor = [...pane.querySelectorAll('a[href*="tab="]')].find((a) => a.getAttribute('href').includes('tab=kyc_ab_test'));
    return anchor ? anchor.textContent.trim() : '';
  });
  await frame.locator('[data-dbt-tab-pane].dbt-tab-active a[href*="tab="]').filter({ hasText: label }).first().click({ force: true });
  await page.waitForTimeout(1500);

  const switched = await state(frame);
  const after = await frameEl.evaluate((el) => el.style.height);
  check('a tab click inside the frame switches the view', switched.visible[0] === 'kyc_ab_test', switched.visible.join(','));
  check(
    'the frame re-fits to the taller tab',
    parseFloat(after) > parseFloat(before),
    `${before} → ${after}`,
  );
  check('the case page raises no console error', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.screenshot({ path: `${SHOTS}/case-embedded-kyc.png` });
  await page.close();
}

await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks passed');
