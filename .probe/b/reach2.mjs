import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4399';
const browser = await chromium.launch();
const pages = ['/posts/bayesian-ab-testing/', '/projects/volta/', '/projects/rfm/'];

const apply = {
  baseline: () => {},
  a_moved_above: () => {
    const nav = document.querySelector('.carousel-nav[data-carousel="reader"]');
    const track = document.querySelector('.reader-track[data-carousel-track]');
    track.parentNode.insertBefore(nav, track);
  },
  b_sticky: () => {
    const nav = document.querySelector('.carousel-nav[data-carousel="reader"]');
    nav.style.cssText += ';position:sticky;bottom:0;z-index:5;background:#111;padding-block:6px;';
  },
  c2_capped: () => {
    const t = document.querySelector('.reader-track[data-carousel-track]');
    t.style.alignItems = 'flex-start';
    for (const s of t.querySelectorAll(':scope > .reader-slide')) {
      s.style.maxHeight = '80vh';
      s.style.overflowY = 'auto';
    }
  },
};

const out = [];
for (const url of pages) {
  for (const [name, fn] of Object.entries(apply)) {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 950 } });
    const p = await ctx.newPage();
    await p.goto(BASE + url, { waitUntil: 'load' });
    await p.waitForTimeout(400);
    await p.evaluate(fn);
    await p.waitForTimeout(100);

    const res = await p.evaluate(async () => {
      const track = document.querySelector('.reader-track[data-carousel-track]');
      const nav = document.querySelector('.carousel-nav[data-carousel="reader"]');
      const trackTop = track.getBoundingClientRect().top + scrollY;
      const trackH = track.getBoundingClientRect().height;
      const rows = [];
      for (const [label, y] of [
        ['article_start', trackTop],
        ['one_screen_in', trackTop + innerHeight],
        ['track_mid', trackTop + trackH / 2],
      ]) {
        scrollTo({ top: y, behavior: 'instant' });
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const nr = nav.getBoundingClientRect();
        const visible = nr.top < innerHeight && nr.bottom > 0;
        // text the nav sits on top of
        let covered = 0;
        if (visible) {
          const els = document.querySelectorAll('.reader-track p, .reader-track li, .reader-track h2, .reader-track h3');
          for (const el of els) {
            const r = el.getBoundingClientRect();
            if (r.bottom > nr.top && r.top < nr.bottom && r.height > 0) covered++;
          }
        }
        rows.push({ label, y: Math.round(y), scrollY: Math.round(scrollY), visible, navViewTop: Math.round(nr.top), coveredEls: covered });
      }
      scrollTo({ top: 0, behavior: 'instant' });
      return { trackTop: Math.round(trackTop), trackH: Math.round(trackH), rows };
    });

    const pr = await p.emulateMedia({ media: 'print' });
    await p.waitForTimeout(100);
    const prn = await p.evaluate(() => {
      const track = document.querySelector('.reader-track[data-carousel-track]');
      const nav = document.querySelector('.carousel-nav[data-carousel="reader"]');
      const cs = getComputedStyle(nav);
      return {
        trackDisplay: getComputedStyle(track).display,
        trackH: Math.round(track.getBoundingClientRect().height),
        navDisplay: cs.display,
        navPosition: cs.position,
        navDocTop: Math.round(nav.getBoundingClientRect().top + scrollY),
      };
    });
    out.push({ url, name, ...res, print: prn });
    await ctx.close();
  }
}
for (const r of out) console.log(JSON.stringify(r));
await browser.close();
