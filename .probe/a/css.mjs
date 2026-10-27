import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4399';
const paths = ['/posts/bayesian-ab-testing/', '/projects/games/', '/projects/volta/', '/posts/cohort-retention-guide/'];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
const page = await ctx.newPage();

for (const p of paths) {
  await page.goto(BASE + p, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const d = await page.evaluate(() => {
    const tr = document.querySelector('[data-carousel-track="reader"]');
    const cs = getComputedStyle(tr);
    const sl = [...tr.querySelectorAll(':scope > .reader-slide')];
    const s0 = getComputedStyle(sl[0]);
    // which stylesheets contain reader rules
    const sheets = [...document.styleSheets].map((s) => s.href || 'inline').filter(Boolean);
    const matched = [];
    for (const s of document.styleSheets) {
      let rules;
      try { rules = s.cssRules; } catch { continue; }
      for (const r of rules || []) {
        if (!r.selectorText) continue;
        if (/reader-track/.test(r.selectorText) && r.style && (r.style.scrollPaddingInline || r.style.scrollPadding || r.style.scrollSnapType || r.style.gap)) {
          matched.push({ sel: r.selectorText, sp: r.style.scrollPaddingInline || r.style.scrollPadding, sst: r.style.scrollSnapType, gap: r.style.gap, href: s.href?.split('/').pop() });
        }
      }
    }
    return {
      cls: tr.className,
      tagHasClass: tr.classList.contains('reader-track'),
      clientWidth: tr.clientWidth,
      slideW: +sl[0].getBoundingClientRect().width.toFixed(2),
      scrollPaddingRight: cs.scrollPaddingRight,
      scrollPaddingLeft: cs.scrollPaddingLeft,
      scrollSnapType: cs.scrollSnapType,
      gap: cs.gap,
      slideSnapAlign: s0.scrollSnapAlign,
      slidePadRight: s0.paddingRight,
      slideFlex: s0.flex,
      sheets,
      matched,
    };
  });
  console.log(p, JSON.stringify(d, null, 1));
}
await browser.close();
