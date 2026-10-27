import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4399';
const urls = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 950 } });
for (const u of urls) {
  const p = await ctx.newPage();
  await p.goto(BASE + u, { waitUntil: 'load' });
  await p.waitForTimeout(600);
  const d = await p.evaluate(() => {
    const track = document.querySelector('.reader-track[data-carousel-track]');
    const nav = document.querySelector('.carousel-nav[data-carousel]');
    if (!track) return { none: true };
    const s = [...track.querySelectorAll(':scope > .reader-slide')];
    const tr = track.getBoundingClientRect();
    const nr = nav ? nav.getBoundingClientRect() : null;
    return {
      slides: s.length,
      trackH: Math.round(tr.height),
      trackTop: Math.round(tr.top + scrollY),
      navTop: nr ? Math.round(nr.top + scrollY) : null,
      navHidden: nav ? nav.hidden : null,
      navH: nr ? Math.round(nr.height) : null,
      slideHeights: s.map(x => Math.round(x.getBoundingClientRect().height)),
      docH: Math.round(document.documentElement.scrollHeight),
      vh: innerHeight,
      alignItems: getComputedStyle(track).alignItems,
    };
  });
  console.log(u, JSON.stringify(d));
  await p.close();
}
await browser.close();
