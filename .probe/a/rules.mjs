import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4399';
const paths = ['/posts/bayesian-ab-testing/', '/projects/volta/', '/projects/games/'];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
const page = await ctx.newPage();

for (const p of paths) {
  await page.goto(BASE + p, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const d = await page.evaluate(() => {
    const tr = document.querySelector('[data-carousel-track="reader"]');
    const cs = getComputedStyle(tr);
    const rules = [];
    for (const s of document.styleSheets) {
      let rs; try { rs = s.cssRules; } catch { continue; }
      for (const r of rs || []) {
        if (!r.selectorText) continue;
        if (!/reader-track/.test(r.selectorText)) continue;
        rules.push({
          sel: r.selectorText,
          spInline: r.style.scrollPaddingInline,
          sp: r.style.scrollPadding,
          spR: r.style.scrollPaddingRight,
          sst: r.style.scrollSnapType,
          href: s.href ? s.href.split('/').pop() : 'inline-len-' + (s.ownerNode?.textContent?.length ?? 0),
        });
      }
    }
    const medias = [];
    for (const s of document.styleSheets) {
      let rs; try { rs = s.cssRules; } catch { continue; }
      for (const r of rs || []) {
        if (r.media && /reader-track/.test(r.cssText)) medias.push({ cond: r.conditionText, href: s.href?.split('/').pop() });
      }
    }
    return {
      computed: { spR: cs.scrollPaddingRight, spL: cs.scrollPaddingLeft, sst: cs.scrollSnapType, gap: cs.gap },
      inlineAttr: tr.getAttribute('style'),
      rules, medias,
      slideCount: tr.querySelectorAll(':scope > .reader-slide').length,
    };
  });
  console.log('===', p, JSON.stringify(d, null, 1));
}
await browser.close();
