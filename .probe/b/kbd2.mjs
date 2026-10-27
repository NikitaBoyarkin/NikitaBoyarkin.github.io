import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:4399';
const browser = await chromium.launch();
const p = await (await browser.newContext({ viewport: { width: 1000, height: 950 } })).newPage();
await p.goto(BASE + '/posts/bayesian-ab-testing/', { waitUntil: 'load' });
await p.waitForTimeout(400);
const info = await p.evaluate(() => {
  const t = document.querySelector('.reader-track');
  return { hasTabindexAttr: t.hasAttribute('tabindex'), tabIndexProp: t.tabIndex,
           linksInSlides: t.querySelectorAll('a[href]').length,
           dots: document.querySelectorAll('.carousel-dot').length };
});
// 1) focus a link inside slide 0, ArrowRight
await p.evaluate(() => {
  const a = document.querySelector('.reader-track a[href]');
  a ? a.focus() : document.body.focus();
});
const before = await p.evaluate(() => Math.round(document.querySelector('.reader-track').scrollLeft));
await p.keyboard.press('ArrowRight');
await p.waitForTimeout(800);
const afterArrow = await p.evaluate(() => Math.round(document.querySelector('.reader-track').scrollLeft));
// 2) can Tab reach the arrows? tab from a link inside slide 0 and count
await p.goto(BASE + '/posts/bayesian-ab-testing/', { waitUntil: 'load' });
await p.waitForTimeout(300);
let reachedNav = false, tabs = 0;
for (let i = 0; i < 120; i++) {
  await p.keyboard.press('Tab');
  tabs++;
  if (await p.evaluate(() => !!document.activeElement?.closest?.('.carousel-nav'))) { reachedNav = true; break; }
}
console.log(JSON.stringify({ ...info, before, afterArrow, reachedNav, tabsToNav: tabs }));
await browser.close();
