import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:4411/posts/bayesian-ab-testing/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
for (const pad of ['0 var(--space-4)', '0']) {
  await page.evaluate((p) => { const tr = document.querySelector('[data-carousel-track="reader"]'); tr.style.scrollPaddingInline = p; tr.scrollTo({ left: 0, behavior: 'auto' }); }, pad);
  await page.waitForTimeout(500);
  const next = await page.$('[data-carousel-next]'); const prev = await page.$('[data-carousel-prev]');
  await next.click(); await page.waitForTimeout(1100);
  const a = await page.evaluate(() => { const t = document.querySelector('[data-carousel-track="reader"]'); return { sl: +t.scrollLeft.toFixed(2), prevAria: document.querySelector('[data-carousel-prev]').getAttribute('aria-disabled'), prevProp: document.querySelector('[data-carousel-prev]').disabled }; });
  await prev.click(); await page.waitForTimeout(3000);
  const b = await page.evaluate(() => { const t = document.querySelector('[data-carousel-track="reader"]'); return { sl: +t.scrollLeft.toFixed(2), prevAria: document.querySelector('[data-carousel-prev]').getAttribute('aria-disabled'), prevProp: document.querySelector('[data-carousel-prev]').disabled }; });
  console.log(pad, JSON.stringify({ afterNext: a, afterPrev: b }));
}
await browser.close();
