import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:4399/projects/ab/#документация', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
console.log(JSON.stringify(await p.evaluate(() => {
  const t = document.querySelector('[data-carousel-track="reader"]');
  const tr = t.getBoundingClientRect(); const hr = document.getElementById('документация').getBoundingClientRect();
  return { scrollLeft: t.scrollLeft, y: window.scrollY, hLeft: Math.round(hr.left), trackL: Math.round(tr.left), inside: hr.left>=tr.left-2&&hr.right<=tr.right+2, active:[...document.querySelectorAll('#inner-toc a.active')].map(a=>a.dataset.id), hash: location.hash };
}), null, 1));
await b.close();
