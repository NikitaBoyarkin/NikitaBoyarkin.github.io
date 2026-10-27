import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4399';
const paths = process.argv.slice(2);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
const page = await ctx.newPage();
const rows = [];

for (const path of paths) {
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(350);
    const has = await page.$('[data-carousel-track="reader"] > .reader-slide');
    if (!has) { rows.push([path, 'no-slides']); continue; }
    const g = await page.evaluate(() => {
      const tr = document.querySelector('[data-carousel-track="reader"]');
      const sl = [...tr.querySelectorAll(':scope > .reader-slide')];
      const cs = getComputedStyle(tr);
      const s0 = getComputedStyle(sl[0]);
      const r = sl.map((s) => s.getBoundingClientRect());
      return {
        cw: tr.clientWidth, sw: tr.scrollWidth,
        n: sl.length,
        w: +r[0].width.toFixed(2),
        h: +r[0].height.toFixed(2),
        padR: s0.paddingRight,
        spa: cs.scrollPaddingRight,
        max: tr.scrollWidth - tr.clientWidth,
        navHidden: document.querySelector('[data-carousel="reader"]')?.hidden,
      };
    });
    const next = await page.$('[data-carousel-next]');
    const prev = await page.$('[data-carousel-prev]');
    if (!next || !prev || g.navHidden) { rows.push([path, 'nav-hidden', g.n]); continue; }
    await next.click();
    await page.waitForTimeout(1200);
    const afterNext = await page.evaluate(() => +document.querySelector('[data-carousel-track="reader"]').scrollLeft.toFixed(2));
    await prev.click();
    await page.waitForTimeout(1200);
    const afterPrev = await page.evaluate(() => +document.querySelector('[data-carousel-track="reader"]').scrollLeft.toFixed(2));
    await page.waitForTimeout(1800);
    const later = await page.evaluate(() => +document.querySelector('[data-carousel-track="reader"]').scrollLeft.toFixed(2));
    rows.push([path, g.n, g.cw, g.w, g.h, g.spa, g.max, afterNext, afterPrev, later]);
  } catch (e) {
    rows.push([path, 'ERR ' + e.message.slice(0, 40)]);
  }
}
console.log(JSON.stringify(rows));
await browser.close();
