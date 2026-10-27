import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4399';
const browser = await chromium.launch();

const variants = {
  baseline: () => {},
  'a_moved_above': () => {
    const nav = document.querySelector('.carousel-nav[data-carousel="reader"]');
    const track = document.querySelector('.reader-track[data-carousel-track]');
    track.parentNode.insertBefore(nav, track);
  },
  'a_css_order': () => {
    const body = document.querySelector('.post-body, #project-content');
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    document.querySelector('.carousel-nav[data-carousel="reader"]').style.order = '-1';
  },
  'b_sticky_bottom': () => {
    const nav = document.querySelector('.carousel-nav[data-carousel="reader"]');
    nav.style.position = 'sticky';
    nav.style.bottom = '0';
    nav.style.zIndex = '5';
  },
  'c1_align_start': () => {
    const t = document.querySelector('.reader-track[data-carousel-track]');
    t.style.alignItems = 'flex-start';
  },
  'c2_maxheight_inner_scroll': () => {
    const t = document.querySelector('.reader-track[data-carousel-track]');
    t.style.alignItems = 'flex-start';
    for (const s of t.querySelectorAll(':scope > .reader-slide')) {
      s.style.maxHeight = '80vh';
      s.style.overflowY = 'auto';
    }
  },
  'e_sticky_in_view': () => {
    const nav = document.querySelector('.carousel-nav[data-carousel="reader"]');
    const track = document.querySelector('.reader-track[data-carousel-track]');
    // move nav into a sticky wrapper that precedes nothing; keep DOM order but sticky-top on a wrapper
    nav.style.position = 'sticky';
    nav.style.bottom = '0';
    nav.style.background = 'var(--card-background, #111)';
  },
};

const pages = ['/posts/bayesian-ab-testing/', '/projects/volta/', '/projects/rfm/'];
const rows = [];
for (const vp of [
  { name: '1000x950', width: 1000, height: 950 },
  { name: '390x844', width: 390, height: 844 },
]) {
  for (const url of pages) {
    for (const [name, fn] of Object.entries(variants)) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const p = await ctx.newPage();
      await p.goto(BASE + url, { waitUntil: 'load' });
      await p.waitForTimeout(400);
      await p.evaluate(fn);
      await p.waitForTimeout(150);
      const d = await p.evaluate(() => {
        const track = document.querySelector('.reader-track[data-carousel-track]');
        const nav = document.querySelector('.carousel-nav[data-carousel="reader"]');
        const tr = track.getBoundingClientRect();
        const nr = nav.getBoundingClientRect();
        const s = [...track.querySelectorAll(':scope > .reader-slide')];
        // nav visible at scroll 0?
        const inView0 = nr.top < innerHeight && nr.bottom > 0;
        return {
          trackH: Math.round(tr.height),
          navTop: Math.round(nr.top + scrollY),
          navRectTop: Math.round(nr.top),
          slidesH: s.map(x => Math.round(x.getBoundingClientRect().height)).slice(0, 3),
          inView0,
          docH: Math.round(document.documentElement.scrollHeight),
        };
      });
      rows.push({ vp: vp.name, url, variant: name, ...d });
      await ctx.close();
    }
  }
}
console.log(JSON.stringify(rows, null, 0).replaceAll('},{', '},\n{'));
await browser.close();
