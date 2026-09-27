import { chromium } from 'playwright';
const url = 'https://nikitaboyarkin.github.io/projects/';
const b = await chromium.launch();
for (const w of [1440, 1100, 900]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  await p.evaluate(() => window.scrollTo(0, 700));
  await p.waitForTimeout(900);
  const info = await p.evaluate(() => {
    const bar = document.querySelector('.project-filter-bar');
    const nav = document.getElementById('site-nav');
    const mob = document.querySelector('.nav-mobile');
    const cs = (el) => { if (!el) return null; const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return { pos: s.position, top: s.top, z: s.zIndex, bg: s.backgroundColor, display: s.display, rect: { t: Math.round(r.top), l: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) } }; };
    // what element is under the bar's top-left area
    const el = document.elementFromPoint(700, 100);
    return { bar: cs(bar), nav: cs(nav), mobile: cs(mob), at700_100: el ? el.className + '|' + el.tagName : null, scrollY: window.scrollY };
  });
  console.log(`--- ${w}px ---`, JSON.stringify(info, null, 1));
  await p.screenshot({ path: `/tmp/proj-${w}.png` });
  await p.close();
}
await b.close();
