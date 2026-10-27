import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
await p.goto('http://localhost:4399/projects/volta/', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
const links = await p.evaluate(() => [...document.querySelectorAll('#inner-toc a')].length);
const target = await p.evaluate(() => {
  const a = [...document.querySelectorAll('#inner-toc a')].find(a => a.textContent.includes('Улика №3'));
  return a ? a.getAttribute('href') : null;
});
const before = await p.evaluate(() => document.querySelector('.reader-track').scrollLeft);
await p.click(`#inner-toc a[href="${target}"]`);
await p.waitForTimeout(1200);
const after = await p.evaluate((sel) => {
  const t = document.querySelector('.reader-track');
  const el = document.querySelector(sel);
  const r = el.getBoundingClientRect();
  return { scrollLeft: t.scrollLeft, inViewport: r.left >= -1 && r.left < window.innerWidth, left: Math.round(r.left), docScrollY: Math.round(window.scrollY) };
}, target);
console.log(JSON.stringify({ links, target, before, after }));
await b.close();
