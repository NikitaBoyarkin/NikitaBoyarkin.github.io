// Temporary: does the 65ch measure squeeze project tables? Playwright + real render.
import { chromium } from 'playwright';

const BASE = `http://localhost:${process.env.PORT || 4399}`;
const PAGES = ['/projects/volta/', '/projects/ab/', '/projects/causal/', '/projects/cohort/', '/projects/streamlit/'];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addInitScript(() => localStorage.setItem('theme', 'dark'));
const page = await ctx.newPage();

console.log('page                       tableW  parent          cols  containerW  overflow  clippedCells');
for (const path of PAGES) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  const r = await page.evaluate(() => {
    const t = document.querySelector('table');
    if (!t) return null;
    const root = document.querySelector('#project-content') || document.body;
    const cells = [...t.querySelectorAll('th, td')];
    const scroll = (el) => el.scrollWidth - el.clientWidth;
    return {
      parent: t.parentElement.tagName.toLowerCase() + (t.parentElement.id ? '#' + t.parentElement.id : ''),
      tableW: Math.round(t.getBoundingClientRect().width),
      containerW: Math.round(root.getBoundingClientRect().width),
      overflow: t.scrollWidth - t.clientWidth,
      rootOverflow: scroll(root),
      cols: t.querySelectorAll('thead th').length || t.querySelectorAll('tr:first-child > *').length,
      worstCellW: cells.length ? Math.round(Math.min(...cells.map((c) => c.scrollWidth / (c.clientWidth || 1))) * 100) / 100 : null,
      clipped: cells.filter((c) => c.scrollWidth > c.clientWidth + 1).length,
    };
  });
  if (!r) { console.log(`${path.padEnd(26)} (no table)`); continue; }
  console.log(
    `${path.padEnd(26)} ${String(r.tableW).padStart(5)}  ${r.parent.padEnd(14)} ${String(r.cols).padStart(5)}  ${String(r.containerW).padStart(10)}  ${String(r.overflow).padStart(8)}  ${String(r.clipped).padStart(4)}`
  );
}

// Screenshot the widest table for a visual diff against before-*.
await page.goto(BASE + '/projects/volta/', { waitUntil: 'networkidle' });
const table = page.locator('table').first();
if (await table.count()) await table.screenshot({ path: 'reports/readability/after-project-table.png' });

await browser.close();
