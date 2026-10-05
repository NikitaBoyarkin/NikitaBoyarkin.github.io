import { chromium } from 'playwright';

const base = process.env.BASE || 'http://localhost:4321';
const url = base + '/projects/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const data = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.project')];
  const chipRows = cards.map((c) => {
    const tools = c.querySelector('.project-tools');
    if (!tools) return { slug: c.dataset.slug, rows: 0, chips: [] };
    const tops = [...tools.querySelectorAll('.project-tool')].map((t) =>
      Math.round(t.getBoundingClientRect().top),
    );
    return {
      slug: c.dataset.slug,
      rows: new Set(tops).size,
      chips: [...tools.querySelectorAll('.project-tool')].map((t) => t.textContent.trim()),
    };
  });
  const actions = cards.map((c) => {
    const a = c.querySelector('.project-actions');
    const b = c.querySelector('.project-actions .button');
    const links = c.querySelector('.project-action-links');
    return {
      slug: c.dataset.slug,
      actionsH: a ? Math.round(a.getBoundingClientRect().height) : 0,
      buttonTop: b ? Math.round(b.getBoundingClientRect().top) : 0,
      hasLinks: Boolean(links),
    };
  });
  const main = document.querySelector('main');
  const card1 = cards[0];
  return {
    chipRows,
    multiRow: chipRows.filter((r) => r.rows > 1).map((r) => r.slug),
    buttonTops: [...new Set(actions.map((a) => a.buttonTop))].sort((x, y) => x - y),
    actionsHeights: [...new Set(actions.map((a) => a.actionsH))].sort((x, y) => x - y),
    noLinks: actions.filter((a) => !a.hasLinks).map((a) => a.slug),
    mainH: main ? Math.round(main.getBoundingClientRect().height) : 0,
    cardH: card1 ? Math.round(card1.getBoundingClientRect().height) : 0,
    gridCols: getComputedStyle(document.getElementById('project-list')).gridTemplateColumns,
  };
});

console.log(JSON.stringify(data, null, 2));
await browser.close();
