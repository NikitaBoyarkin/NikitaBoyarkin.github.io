import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:4399/projects/volta/funnel/', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const shape = await page.evaluate(() => {
  const c = document.querySelector('#project-content');
  return {
    hasTrack: !!document.querySelector('[data-carousel-track="reader"]'),
    tocLinks: document.querySelectorAll('#inner-toc a').length,
    tocVisible: !!document.getElementById('inner-toc')?.getClientRects().length,
    offsets: [...c.querySelectorAll('h2,h3')].map(h => ({ id: h.id, top: h.offsetTop })),
    docH: document.documentElement.scrollHeight,
  };
});
const before = await page.evaluate(() => [...document.querySelectorAll('#inner-toc a.active')].map(a=>a.dataset.id));
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.6));
await page.waitForTimeout(600);
const after = await page.evaluate(() => ({ active: [...document.querySelectorAll('#inner-toc a.active')].map(a=>a.dataset.id), y: window.scrollY }));
// click a TOC link here (vertical page): does it jump?
const click = await page.evaluate(async () => {
  const a = [...document.querySelectorAll('#inner-toc a')].pop();
  a.click();
  await new Promise(r=>setTimeout(r,900));
  return { hash: location.hash, y: window.scrollY, active: [...document.querySelectorAll('#inner-toc a.active')].map(x=>x.dataset.id) };
});
console.log(JSON.stringify({ shape, before, after, click }, null, 1));
await browser.close();
