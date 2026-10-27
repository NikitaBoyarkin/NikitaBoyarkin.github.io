import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const p = await ctx.newPage();
for (const url of ['http://localhost:4399/projects/volta/', 'http://localhost:4399/en/projects/volta/']) {
  await p.goto(url, { waitUntil: 'networkidle' });
  const r = await p.evaluate(() => {
    const h = document.querySelector('#project-content h1');
    if (!h) return null;
    const cs = getComputedStyle(h);
    const inSlide = h.closest('.reader-slide')?.dataset.slide ?? 'none';
    return { inSlide, parent: h.parentElement.className, fs: cs.fontSize, fw: cs.fontWeight, lh: cs.lineHeight, ls: cs.letterSpacing, mb: cs.marginBlockEnd };
  });
  console.log(url, JSON.stringify(r));
}
await b.close();
