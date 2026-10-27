import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4411';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
const page = await ctx.newPage();
await page.goto(BASE + '/posts/bayesian-ab-testing/', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

// how many carousels / prev buttons?
console.log('navs:', await page.evaluate(() => [...document.querySelectorAll('[data-carousel]')].map((n) => n.dataset.carousel)));
console.log('prev buttons:', await page.evaluate(() => document.querySelectorAll('[data-carousel-prev]').length));

const band = await page.evaluate(async () => {
  const tr = document.querySelector('[data-carousel-track="reader"]');
  tr.style.scrollPaddingInline = '0 var(--space-4)';
  const out = [];
  for (const t of [0, 5, 10, 15, 16, 17, 18, 19, 20, 25, 359, 360, 719]) {
    tr.scrollTo({ left: t, behavior: 'auto' });
    await new Promise((r) => setTimeout(r, 450));
    out.push([t, +tr.scrollLeft.toFixed(2)]);
  }
  return { spR: getComputedStyle(tr).scrollPaddingRight, out };
});
console.log('band (pad 16):', JSON.stringify(band));

// prev.disabled state scoped to the reader nav, pad 16 vs 0
const dis = await page.evaluate(async () => {
  const tr = document.querySelector('[data-carousel-track="reader"]');
  const nav = [...document.querySelectorAll('[data-carousel="reader"]')][0];
  const prev = nav.querySelector('[data-carousel-prev]');
  const res = {};
  for (const pad of ['0 var(--space-4)', '0']) {
    tr.style.scrollPaddingInline = pad;
    tr.scrollTo({ left: 0, behavior: 'auto' });
    await new Promise((r) => setTimeout(r, 700));
    res['pad_' + (pad === '0' ? '0' : '16')] = { scrollLeft: +tr.scrollLeft.toFixed(2), prevDisabled: prev.disabled };
  }
  tr.style.scrollPaddingInline = '';
  return res;
});
console.log('prev.disabled at slide 0:', JSON.stringify(dis));

// full-page scrollBy(-clientWidth) from 719, pad 16 -> does 0.9 matter?
const mult = await page.evaluate(async () => {
  const tr = document.querySelector('[data-carousel-track="reader"]');
  const nav = [...document.querySelectorAll('[data-carousel="reader"]')][0];
  const prev = nav.querySelector('[data-carousel-prev]');
  tr.style.scrollPaddingInline = '0 var(--space-4)';
  const out = {};
  for (const k of [1.0, 0.9]) {
    tr.scrollTo({ left: 0, behavior: 'auto' });
    await new Promise((r) => setTimeout(r, 500));
    tr.scrollBy({ left: tr.clientWidth * k, behavior: 'auto' });
    await new Promise((r) => setTimeout(r, 700));
    const at = +tr.scrollLeft.toFixed(2);
    tr.scrollBy({ left: -tr.clientWidth * k, behavior: 'auto' });
    await new Promise((r) => setTimeout(r, 1200));
    out['k=' + k] = { afterNext: at, afterPrev: +tr.scrollLeft.toFixed(2), prevDisabled: prev.disabled };
  }
  tr.style.scrollPaddingInline = '';
  return out;
});
console.log('multiplier effect:', JSON.stringify(mult));
await browser.close();
