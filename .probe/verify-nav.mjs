import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const p = await ctx.newPage();
const url = 'http://localhost:4399/projects/volta/';
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(900);

const geo = await p.evaluate(() => {
  const t = document.querySelector('.reader-track');
  const nav = document.querySelector('[data-carousel="reader"]');
  const r = t.getBoundingClientRect(), n = nav?.getBoundingClientRect();
  return {
    trackTop: Math.round(r.top), trackHeight: Math.round(r.height),
    navFound: !!nav, navHidden: nav?.hidden, navTop: n ? Math.round(n.top) : null,
    navViewportOffset: n ? Math.round(n.top) : null,
    dots: document.querySelectorAll('.carousel-dot').length,
    slides: document.querySelectorAll('.reader-slide').length,
    scrollWidth: t.scrollWidth, clientWidth: t.clientWidth,
  };
});
console.log('GEO', JSON.stringify(geo));

const toc = await p.evaluate(async () => {
  const t = document.querySelector('.reader-track');
  const before = [...document.querySelectorAll('#inner-toc a')].map(a => [a.getAttribute('href'), a.className, a.getAttribute('aria-current')]).filter(x => /active|current|true/.test(String(x[1]) + x[2]));
  t.scrollLeft = t.clientWidth * 5;
  await new Promise(r => setTimeout(r, 800));
  const after = [...document.querySelectorAll('#inner-toc a')].map(a => [a.getAttribute('href'), a.className, a.getAttribute('aria-current')]).filter(x => /active|current|true/.test(String(x[1]) + x[2]));
  return { before, after, tocSelectorSample: document.querySelector('#inner-toc a')?.outerHTML.slice(0, 120) };
});
console.log('TOC', JSON.stringify(toc));

// controls reachable? scroll to nav and click next from a mid position
const click = await p.evaluate(async () => {
  const t = document.querySelector('.reader-track');
  const nav = document.querySelector('[data-carousel="reader"]');
  nav.scrollIntoView({ block: 'center' });
  const n = nav.querySelector('[data-carousel-next]');
  const s0 = t.scrollLeft;
  n.click();
  await new Promise(r => setTimeout(r, 900));
  const s1 = t.scrollLeft;
  const dots = [...document.querySelectorAll('.carousel-dot')];
  return { s0, s1, delta: s1 - s0, clientWidth: t.clientWidth, activeDot: dots.findIndex(d => d.getAttribute('aria-current') === 'true'), dotCount: dots.length };
});
console.log('CLICK', JSON.stringify(click));
await p.screenshot({ path: '.probe/shots/verify-nav.png' });
await b.close();
