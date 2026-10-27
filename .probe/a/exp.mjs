import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4399';
const url = BASE + '/posts/bayesian-ab-testing/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

async function settle(from, mutate = '', label = '') {
  return page.evaluate(async ({ from, mutate }) => {
    const tr = document.querySelector('[data-carousel-track="reader"]');
    if (mutate) eval(mutate);
    tr.scrollTo({ left: from, behavior: 'auto' });
    await new Promise((r) => setTimeout(r, 900));
    const first = +tr.scrollLeft.toFixed(2);
    await new Promise((r) => setTimeout(r, 700));
    return { label: '', from, settled: first, stable: first === +tr.scrollLeft.toFixed(2) };
  }, { from, mutate, label });
}

const out = [];

out.push({ case: 'baseline 40 -> ?', ...(await settle(40)) });
out.push({ case: 'baseline 719 -> ?', ...(await settle(719)) });
out.push({ case: 'baseline 300 -> ?', ...(await settle(300)) });
out.push({ case: 'baseline 600 -> ?', ...(await settle(600)) });
out.push({ case: 'baseline 350 (midpoint 359.5) -> ?', ...(await settle(350)) });
out.push({ case: 'baseline 370 -> ?', ...(await settle(370)) });

// What does the scrollBy of step(-1) actually land on, before snap?
out.push({
  case: 'raw step math',
  ...(await page.evaluate(async () => {
    const tr = document.querySelector('[data-carousel-track="reader"]');
    tr.scrollTo({ left: 0, behavior: 'auto' });
    await new Promise((r) => setTimeout(r, 500));
    tr.scrollTo({ left: 0 });
    await new Promise((r) => setTimeout(r, 400));
    const clientWidth = tr.clientWidth;
    return { clientWidth, stepDelta: clientWidth * 0.9, afterNext: +tr.scrollLeft.toFixed(2) };
  })),
});

// Experiment: kill scroll-padding
out.push({ case: 'no scroll-padding, from 40', ...(await settle(40, "tr.style.scrollPaddingInline='0 0'")) });
out.push({ case: 'no scroll-padding, from 300', ...(await settle(300, "tr.style.scrollPaddingInline='0 0'")) });
out.push({ case: 'no scroll-padding, from 719', ...(await settle(719, "tr.style.scrollPaddingInline='0 0'")) });
// Experiment: padding-right 8
out.push({ case: 'scroll-padding 0/8, from 40', ...(await settle(40, "tr.style.scrollPaddingInline='0 8px'")) });
// Experiment: no snap at all
out.push({ case: 'snap none, from 40', ...(await settle(40, "tr.style.scrollSnapType='none'")) });
out.push({ case: 'snap none, from 300', ...(await settle(300, "tr.style.scrollSnapType='none'")) });
// Experiment: snap none + scroll-padding none -> raw
out.push({ case: 'snap none + pad none, from 40', ...(await settle(40, "tr.style.scrollSnapType='none';tr.style.scrollPaddingInline='0 0'")) });
// Experiment: restore, then check snap positions list via scrolling small increments
out.push({
  case: 'snap point sweep (mandatory, scroll-padding 0/16)',
  ...(await page.evaluate(async () => {
    const tr = document.querySelector('[data-carousel-track="reader"]');
    tr.style.scrollSnapType = '';
    tr.style.scrollPaddingInline = '';
    const seen = [];
    for (const target of [5, 16, 20, 30, 100, 200, 400, 700, 710, 715, 719, 730, 1400, 1430]) {
      tr.scrollTo({ left: target, behavior: 'auto' });
      await new Promise((r) => setTimeout(r, 500));
      seen.push([target, +tr.scrollLeft.toFixed(2)]);
    }
    return { seen };
  })),
});

console.log(JSON.stringify(out, null, 2));
await browser.close();
