import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:4399';
const browser = await chromium.launch();
const p = await (await browser.newContext({ viewport: { width: 1000, height: 950 } })).newPage();
for (const url of ['/posts/bayesian-ab-testing/', '/projects/volta/', '/projects/rfm/']) {
  await p.goto(BASE + url, { waitUntil: 'load' });
  await p.waitForTimeout(300);
  const chain = await p.evaluate(() => {
    const out = [];
    let el = document.querySelector('.carousel-nav[data-carousel="reader"]');
    while (el && el !== document.documentElement) {
      const cs = getComputedStyle(el);
      out.push({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 40),
                 overflow: `${cs.overflowX}/${cs.overflowY}`, contain: cs.contain, transform: cs.transform === 'none' ? 'none' : 'set' });
      el = el.parentElement;
    }
    return out;
  });
  // does sticky actually stick at a mid-track scroll?
  const stickTest = await p.evaluate(async () => {
    const track = document.querySelector('.reader-track[data-carousel-track]');
    const nav = document.querySelector('.carousel-nav[data-carousel="reader"]');
    nav.style.cssText += ';position:sticky;bottom:0;z-index:5;background:#111;';
    scrollTo({ top: track.getBoundingClientRect().top + scrollY + 400, behavior: 'instant' });
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const nr = nav.getBoundingClientRect();
    return { navBottom: Math.round(nr.bottom), vh: innerHeight, sticking: Math.abs(nr.bottom - innerHeight) < 2 };
  });
  console.log(url, JSON.stringify(stickTest), JSON.stringify(chain));
}
await browser.close();
