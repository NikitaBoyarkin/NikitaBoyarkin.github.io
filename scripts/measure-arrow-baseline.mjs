// F4 probe: does an inline <morph-icon> shift the text baseline of the link it
// sits in? morphicons' shell only sets `morph-icon { display: contents }`, so
// the inner <svg> is the layout box — an inline replaced element unless its
// parent is a flex container. This measures, per host anchor, the anchor's
// computed display/align and the vertical delta between the svg centre and the
// anchor's text centre. ~0 delta on an inline-flex host = no shift.
//
// Usage: bun run serve-dist   (or `npx astro preview`) first, then:
//   node scripts/measure-arrow-baseline.mjs    (BASE env overrides the origin)

import { chromium } from 'playwright';

const base = process.env.BASE || 'http://localhost:4321';
const page_url = `${base}/projects/`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
await page.goto(page_url, { waitUntil: 'networkidle' });

const rows = await page.evaluate(() => {
  const out = [];
  for (const a of document.querySelectorAll('a.button, a.nav-chip')) {
    const host = a.querySelector('morph-icon, svg');
    if (!host) continue;
    const svg = host.tagName.toLowerCase() === 'morph-icon' ? host.querySelector('svg') : host;
    if (!svg) continue;

    const box = svg.getBoundingClientRect();
    const r = document.createRange();
    let text = null;
    for (const n of a.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim()) {
        r.selectNodeContents(n);
        text = r.getBoundingClientRect();
        break;
      }
    }
    const cs = getComputedStyle(a);
    const svgMid = box.top + box.height / 2;
    out.push({
      label: a.textContent.trim().slice(0, 20),
      host: host.tagName.toLowerCase(),
      display: cs.display,
      alignItems: cs.alignItems,
      anchorH: +a.getBoundingClientRect().height.toFixed(1),
      svgH: +box.height.toFixed(1),
      lineH: cs.lineHeight,
      svgMidY: +svgMid.toFixed(2),
      textMidY: text ? +(text.top + text.height / 2).toFixed(2) : null,
      deltaMidY: text ? +(svgMid - (text.top + text.height / 2)).toFixed(2) : null,
    });
  }
  return out;
});

console.table(rows);
const inlineHosts = rows.filter((r) => !r.display.includes('flex'));
console.log(
  `\n${rows.length} morph hosts · ${inlineHosts.length} non-flex (baseline-exposed) · ` +
    `max |deltaMidY| = ${Math.max(0, ...rows.map((r) => Math.abs(r.deltaMidY ?? 0))).toFixed(2)}px`,
);
if (inlineHosts.length) console.log('BASELINE-EXPOSED:', inlineHosts.map((r) => r.label));

await browser.close();
