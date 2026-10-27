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
    await p.waitForTimeout(150);

    const res = await p.evaluate(() => {
      const track = document.querySelector('.reader-track[data-carousel-track]');
      const nav = document.querySelector('.carousel-nav[data-carousel="reader"]');
      const trackTop = track.getBoundingClientRect().top + scrollY;
      const probe = [];
      // At three reading positions: article start, 1 screen in, mid-track
      for (const label of ['article_start', 'one_screen_in', 'track_mid']) {
        const y =
          label === 'article_start' ? trackTop
          : label === 'one_screen_in' ? trackTop + innerHeight
          : trackTop + track.getBoundingClientRect().height / 2;
        scrollTo(0, y);
        const nr = nav.getBoundingClientRect();
        const visible = nr.top < innerHeight && nr.bottom > 0;
        probe.push({ label, visible, navTopInView: Math.round(nr.top) });
      }
      scrollTo(0, 0);
      // Overlap check: does the sticky nav cover the tail of the active slide?
      const first = track.querySelector(':scope > .reader-slide');
      const navR = nav.getBoundingClientRect();
      const last = [...first.querySelectorAll('*')].filter(e => e.textContent.trim()).pop();
      const lr = last ? last.getBoundingClientRect() : null;
      return {
        probe,
        navSticky: getComputedStyle(nav).position,
        overlapPx: lr && navR.width ? Math.round(Math.max(0, lr.bottom - navR.top)) : null,
      };
    });
    // print emulation
    await p.emulateMedia({ media: 'print' });
    await p.waitForTimeout(100);
    const pr = await p.evaluate(() => {
      const track = document.querySelector('.reader-track[data-carousel-track]');
      const nav = document.querySelector('.carousel-nav[data-carousel="reader"]');
      const s = [...track.querySelectorAll(':scope > .reader-slide')];
      const tr = track.getBoundingClientRect();
      return {
        trackDisplay: getComputedStyle(track).display,
        trackH: Math.round(tr.height),
        navTop: Math.round(nav.getBoundingClientRect().top + scrollY),
        slideWs: s.map(x => Math.round(x.getBoundingClientRect().width)).slice(0, 3),
        docH: Math.round(document.documentElement.scrollHeight),
      };
    });
    await p.emulateMedia({ media: 'screen' });
    await p.emulateMedia({ reducedMotion: 'reduce' });
    const rm = await p.evaluate(() => {
      const t = document.querySelector('.reader-track[data-carousel-track]');
      return { scrollBehavior: getComputedStyle(t).scrollBehavior, trackH: Math.round(t.getBoundingClientRect().height) };
    });
    out.push({ url, name, ...res, print: pr, reducedMotion: rm });
    await ctx.close();
  }
}
for (const r of out) console.log(JSON.stringify(r));
await browser.close();
