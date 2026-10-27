import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4399';
const candidates = process.argv.slice(2);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
const page = await ctx.newPage();

const results = [];

for (const path of candidates) {
  const url = BASE + path;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(600);

    const geo = await page.evaluate(() => {
      const track = document.querySelector('[data-carousel-track="reader"]');
      if (!track) return { none: true };
      const cs = getComputedStyle(track);
      const slides = [...track.querySelectorAll(':scope > .reader-slide')];
      const rootCS = getComputedStyle(document.documentElement);
      return {
        clientWidth: track.clientWidth,
        scrollWidth: track.scrollWidth,
        scrollLeft: track.scrollLeft,
        gap: cs.gap,
        columnGap: cs.columnGap,
        scrollSnapType: cs.scrollSnapType,
        scrollPaddingLeft: cs.scrollPaddingLeft,
        scrollPaddingRight: cs.scrollPaddingRight,
        boxSizing: cs.boxSizing,
        paddingLeft: cs.paddingLeft,
        paddingRight: cs.paddingRight,
        space4: rootCS.getPropertyValue('--space-4').trim(),
        space5: rootCS.getPropertyValue('--space-5').trim(),
        space6: rootCS.getPropertyValue('--space-6').trim(),
        slideCount: slides.length,
        slides: slides.map((s) => {
          const r = s.getBoundingClientRect();
          const scs = getComputedStyle(s);
          return {
            w: +r.width.toFixed(2),
            h: +r.height.toFixed(2),
            offsetLeft: s.offsetLeft,
            offsetWidth: s.offsetWidth,
            scrollWidth: s.scrollWidth,
            clientWidth: s.clientWidth,
            snapAlign: scs.scrollSnapAlign,
            padRight: scs.paddingRight,
            // does content overflow inside the slide?
            innerOverflow: s.scrollWidth - s.clientWidth,
            // widest descendant
            widest: Math.max(0, ...[...s.querySelectorAll('*')].map((e) => Math.round(e.getBoundingClientRect().width))),
          };
        }),
        navs: [...document.querySelectorAll('[data-carousel="reader"]')].length,
        dots: document.querySelector('[data-carousel-dots]')?.childElementCount ?? null,
        dotsHidden: document.querySelector('[data-carousel-dots]')?.hidden ?? null,
      };
    });

    if (geo.none) { results.push({ path, none: true }); continue; }

    const trace = async (ms) => {
      const t = [];
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        t.push(await page.evaluate(() => {
          const tr = document.querySelector('[data-carousel-track="reader"]');
          return { t: Math.round(performance.now()), sl: +tr.scrollLeft.toFixed(2) };
        }));
        await page.waitForTimeout(120);
      }
      return t;
    };

    const nextBtn = await page.$('[data-carousel-next]');
    const prevBtn = await page.$('[data-carousel-prev]');
    if (!nextBtn || !prevBtn) { results.push({ path, geo, noButtons: true }); continue; }

    await page.evaluate(() => { document.querySelector('[data-carousel-track="reader"]').scrollTo({ left: 0, behavior: 'auto' }); });
    await page.waitForTimeout(300);
    await nextBtn.click();
    const afterNext = await trace(1200);
    const prevDisabledBefore = await prevBtn.evaluate((b) => b.disabled);
    await prevBtn.click();
    const afterPrev = await trace(3200);
    const prevDisabledAfter = await prevBtn.evaluate((b) => b.disabled);
    const final = await page.evaluate(() => {
      const tr = document.querySelector('[data-carousel-track="reader"]');
      return { scrollLeft: +tr.scrollLeft.toFixed(2) };
    });

    results.push({
      path,
      clientWidth: geo.clientWidth,
      scrollWidth: geo.scrollWidth,
      gap: geo.gap,
      space4: geo.space4, space5: geo.space5, space6: geo.space6,
      scrollPadding: `${geo.scrollPaddingLeft}/${geo.scrollPaddingRight}`,
      slideCount: geo.slideCount,
      slideWidths: geo.slides.map((s) => s.w),
      slideHeights: geo.slides.map((s) => s.h),
      innerOverflow: geo.slides.map((s) => s.innerOverflow),
      dots: geo.dots, dotsHidden: geo.dotsHidden,
      nextSettled: afterNext.at(-1)?.sl,
      prevSettled: afterPrev.at(-1)?.sl,
      prevTrace: afterPrev.filter((_, i) => i % 2 === 0).map((x) => x.sl),
      prevDisabledBefore, prevDisabledAfter,
      final,
    });
  } catch (e) {
    results.push({ path, error: e.message });
  }
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
