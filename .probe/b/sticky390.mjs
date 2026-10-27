import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4399';
const browser = await chromium.launch();
const pages = ['/posts/bayesian-ab-testing/', '/projects/volta/', '/projects/rfm/'];

for (const vp of [{ w: 390, h: 844 }, { w: 1000, h: 950 }]) {
  for (const url of pages) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const p = await ctx.newPage();
    await p.goto(BASE + url, { waitUntil: 'load' });
    await p.waitForTimeout(500);
    const base = await p.evaluate(() => {
      const track = document.querySelector('.reader-track[data-carousel-track]');
      const nav = document.querySelector('.carousel-nav[data-carousel="reader"]');
      const dots = nav.querySelector('[data-carousel-dots]');
      return {
        slides: track.querySelectorAll(':scope > .reader-slide').length,
        trackH: Math.round(track.getBoundingClientRect().height),
        navDocTop: Math.round(nav.getBoundingClientRect().top + scrollY),
        dotsHidden: dots.hidden,
        navHidden: nav.hidden,
        vh: innerHeight,
      };
    });
    // sticky variant, at the natural reading start
    await p.evaluate(() => {
      const nav = document.querySelector('.carousel-nav[data-carousel="reader"]');
      nav.style.cssText += ';position:sticky;bottom:0;z-index:5;background:#111;padding-block:6px;';
    });
    const sticky = await p.evaluate(async () => {
      const track = document.querySelector('.reader-track[data-carousel-track]');
      const nav = document.querySelector('.carousel-nav[data-carousel="reader"]');
      scrollTo({ top: track.getBoundingClientRect().top + scrollY, behavior: 'instant' });
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const nr = nav.getBoundingClientRect();
      let covered = 0;
      for (const el of document.querySelectorAll('.reader-track p, .reader-track li')) {
        const r = el.getBoundingClientRect();
        if (r.bottom > nr.top && r.top < nr.bottom && r.height > 0) covered++;
      }
      return { navViewTop: Math.round(nr.top), navHeight: Math.round(nr.height), coveredEls: covered,
               navOverlapsViewportBottom: Math.round(innerHeight - nr.bottom) };
    });
    console.log(JSON.stringify({ vp: `${vp.w}x${vp.h}`, url, ...base, sticky }));
    await ctx.close();
  }
}
await browser.close();
