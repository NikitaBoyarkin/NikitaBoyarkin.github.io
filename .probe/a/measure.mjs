import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4411';
const pages = ['/posts/bayesian-ab-testing/', '/posts/cohort-retention-guide/', '/projects/volta/'];
const vps = [
  { name: '1000x800', width: 1000, height: 800 },
  { name: '390x844', width: 390, height: 844 },
];

const browser = await chromium.launch();

for (const vp of vps) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  for (const p of pages) {
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const d = await page.evaluate(() => {
      const tr = document.querySelector('[data-carousel-track="reader"]');
      if (!tr) return { none: true };
      const cs = getComputedStyle(tr);
      const sl = [...tr.querySelectorAll(':scope > .reader-slide')];
      const w = sl[0].getBoundingClientRect().width;
      const stride = sl[1] ? sl[1].getBoundingClientRect().left - sl[0].getBoundingClientRect().left : w + 20;
      const overflow = tr.scrollWidth - tr.clientWidth;
      const dots = document.querySelector('[data-carousel-dots]');
      return {
        n: sl.length,
        cw: tr.clientWidth,
        sw: tr.scrollWidth,
        slideW: +w.toFixed(2),
        gap: parseFloat(cs.columnGap),
        stride: +stride.toFixed(2),
        overflow,
        spR: cs.scrollPaddingRight,
        sst: cs.scrollSnapType,
        dots: dots?.childElementCount ?? null,
        dotsHidden: dots?.hidden ?? null,
        oldFormula: Math.max(1, Math.round(overflow / tr.clientWidth) + 1),
        newFormula: Math.max(1, Math.round(overflow / stride) + 1),
        maxScroll: overflow,
      };
    });
    // prev test under ORIGINAL css: inject scroll-padding-right via inline style
    const prevTest = async (pad) => {
      await page.evaluate((pad) => {
        const tr = document.querySelector('[data-carousel-track="reader"]');
        tr.style.scrollPaddingInline = pad;
        tr.scrollTo({ left: 0, behavior: 'auto' });
      }, pad);
      await page.waitForTimeout(500);
      const next = await page.$('[data-carousel-next]');
      const prev = await page.$('[data-carousel-prev]');
      await next.click();
      await page.waitForTimeout(1000);
      const afterNext = await page.evaluate(() => +document.querySelector('[data-carousel-track="reader"]').scrollLeft.toFixed(2));
      await prev.click();
      await page.waitForTimeout(2600);
      const afterPrev = await page.evaluate(() => +document.querySelector('[data-carousel-track="reader"]').scrollLeft.toFixed(2));
      await page.waitForTimeout(1200);
      const later = await page.evaluate(() => +document.querySelector('[data-carousel-track="reader"]').scrollLeft.toFixed(2));
      const dis = await prev.evaluate((b) => b.disabled);
      await page.evaluate(() => { document.querySelector('[data-carousel-track="reader"]').style.scrollPaddingInline = ''; });
      return { pad, afterNext, afterPrev, later, prevDisabled: dis };
    };
    d.prev_orig16 = await prevTest('0 var(--space-4)');
    d.prev_now0 = await prevTest('0');
    console.log(vp.name, p, JSON.stringify(d));
  }
  await ctx.close();
}
await browser.close();
