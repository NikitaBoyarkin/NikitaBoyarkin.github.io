// Regression check for the chart tabs on the standalone demo boards
// (`public/demos/demo-tabs.js` + `.demo-tablist` in `public/demos/demo.css`).
//
// The failures a markup grep cannot see, and the reason this drives a browser:
//   · tabs that flip `aria-selected` while the panels keep showing everything;
//   · a panel revealed at width 0, because its chart was sized from
//     `clientWidth` while it was still `hidden` (posthog and streamlit do this);
//   · a JS error on the boards that own their own charts.
//
// The boards are static files in `public/`, so this can run without a full
// `astro build`: point PUBLIC_DIR at a server rooted at `public/`
//   python3 -m http.server -d public 4321 &
//   bun run verify:demo-tabs
// or at a built site:
//   bun run serve-dist &
//   BASE_URL=http://localhost:4321/ bun run verify:demo-tabs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const baseUrl = process.env.BASE_URL || 'http://localhost:4321/demos/';
const SHOTS = process.env.SHOT_DIR || 'reports/demo-tabs';
const BOARDS = (process.env.BOARDS || 'ab,posthog,streamlit,linkedin,supabase').split(',');

const failures = [];
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch();

for (const slug of BOARDS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto(`${baseUrl}${slug}/`, { waitUntil: 'load' });
  await page.waitForSelector('.demo-tablist', { timeout: 5000 });

  const counts = await page.evaluate(() => ({
    tabs: document.querySelectorAll('.demo-tablist [role="tab"]').length,
    panels: document.querySelectorAll('[role="tabpanel"]').length,
    visible: document.querySelectorAll('[role="tabpanel"]:not([hidden])').length,
  }));
  check(
    `${slug}: one tab per panel, one panel visible`,
    counts.tabs === counts.panels && counts.panels >= 2 && counts.visible === 1,
    JSON.stringify(counts),
  );

  const labels = await page.$$eval('.demo-tablist [role="tab"]', (els) =>
    els.map((el) => el.textContent.trim()),
  );
  check(`${slug}: labels are short`, labels.every((l) => l.length > 0 && l.length <= 40), labels.join(' | '));

  for (let i = 0; i < counts.tabs; i += 1) {
    await page.click(`.demo-tablist [role="tab"]:nth-child(${i + 1})`);
    const state = await page.evaluate((index) => {
      const tabs = [...document.querySelectorAll('.demo-tablist [role="tab"]')];
      const panels = [...document.querySelectorAll('[role="tabpanel"]')];
      const visible = panels.filter((p) => !p.hidden);
      const box = visible[0]?.getBoundingClientRect();
      return {
        selected: tabs[index].getAttribute('aria-selected'),
        visibleCount: visible.length,
        visibleIndex: panels.indexOf(visible[0]),
        width: Math.round(box?.width ?? 0),
      };
    }, i);
    check(
      `${slug}: tab ${i + 1} shows only its own panel`,
      state.selected === 'true' &&
        state.visibleCount === 1 &&
        state.visibleIndex === i &&
        state.width > 200,
      JSON.stringify(state),
    );
  }

  await page.click('.demo-tablist [role="tab"]:nth-child(1)');
  await page.screenshot({ path: `${SHOTS}/${slug}.png`, fullPage: false });
  check(`${slug}: no JS errors`, errors.length === 0, errors.join(' | '));
  await page.close();
}

await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log('\nAll demo-tab checks passed.');
