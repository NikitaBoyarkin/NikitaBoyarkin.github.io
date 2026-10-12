// Readability probe for the About bento cells (`.wwm-block` inside `.bento-grid`).
// Serves a built dist/ and measures type + contrast on /about/ and /en/about/.
// Usage: bun run build && bun run serve-dist & PORT=4399 bun scripts/probe-about-bento.mjs <label>
import { chromium } from 'playwright';

const PORT = process.env.PORT || 4321;
const label = process.argv[2] || 'run';
const THEMES = ['dark', 'light', 'cyberpunk'];
const PAGES = ['about/', 'en/about/'];
const BASE = `http://localhost:${PORT}/`;

// NOTE: MEASURE is serialised and runs in the page, so every helper it needs
// must be defined inside it — outer-scope closures are not carried over.
const MEASURE = () => {
  const px = (v) => parseFloat(v) || 0;
  const lum = (rgb) => {
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  };
  const parse = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const ratio = (a, b) => {
    const [x, y] = [lum(parse(a)), lum(parse(b))].sort((m, n) => n - m);
    return +((x + 0.05) / (y + 0.05)).toFixed(2);
  };
  // The bento lives in the "work" tab of the /about dashboard now, hidden until
  // its tab is active — reveal it so the cells have a real layout to measure.
  document.querySelector('[data-tab="work"]')?.click();
  const cards = [...document.querySelectorAll('.bento-grid .wwm-block')];
  const cw = document.createElement('span');
  cw.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
  cw.textContent = '0'.repeat(10);
  document.body.appendChild(cw);

  return cards.map((card) => {
    const h3 = card.querySelector('h3');
    const lis = [...card.querySelectorAll('li')];
    const li = lis[0];
    const cs = getComputedStyle(li || card);
    const bg = getComputedStyle(card).backgroundColor;
    const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    cw.style.font = font;
    const charW = cw.getBoundingClientRect().width / 10;
    const inner = px(getComputedStyle(card).paddingLeft); // left padding inside border
    const innerW = card.getBoundingClientRect().width - inner * 2;
    const lines = lis.map((el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return r.getClientRects().length;
    });
    return {
      title: h3?.textContent?.trim().slice(0, 22) || '',
      titleSize: h3 ? px(getComputedStyle(h3).fontSize) : 0,
      titleFont: h3 ? getComputedStyle(h3).fontFamily.split(',')[0].replace(/['"]/g, '') : '',
      titleColor: h3 ? getComputedStyle(h3).color : '',
      liCount: lis.length,
      size: px(cs.fontSize),
      lh: px(cs.lineHeight),
      lhRatio: +(px(cs.lineHeight) / px(cs.fontSize)).toFixed(2),
      color: cs.color,
      bg,
      contrast: ratio(cs.color, bg),
      chars: Math.round(innerW / charW),
      cardW: Math.round(card.getBoundingClientRect().width),
      cardH: Math.round(card.getBoundingClientRect().height),
      pad: getComputedStyle(card).padding,
      lines: lines.join('/'),
      wrap: lines.some((n) => n > 1) ? 'wraps' : 'single',
    };
  });
};

const browser = await chromium.launch();
const rows = [];
for (const theme of THEMES) {
  for (const page of PAGES) {
    for (const [vw, vh, tag] of [
      [1440, 900, 'desktop'],
      [390, 844, 'mobile'],
    ]) {
      const ctx = await browser.newContext({
        viewport: { width: vw, height: vh },
        colorScheme: theme === 'dark' ? 'dark' : 'light',
      });
      await ctx.addInitScript((t) => {
        try {
          localStorage.setItem('theme', t);
        } catch {}
      }, theme);
      const p = await ctx.newPage();
      await p.goto(BASE + page, { waitUntil: 'load' });
      await p.evaluate(() => document.fonts.ready);
      await p.evaluate(() => window.scrollTo(0, 99999));
      await p.waitForTimeout(250);
      const actual = await p.evaluate(() => document.documentElement.dataset.theme || '(root)');
      const cards = await p.evaluate(MEASURE);
      cards.forEach((c, i) =>
        rows.push({ theme, actual, page: page.replace('about/', 'about'), tag, i, ...c }),
      );
      await ctx.close();
    }
  }
}
await browser.close();

console.log(`\n### probe-about-bento [${label}]\n`);
console.log(
  [
    'theme',
    'actual',
    'page',
    'vw',
    'card W×H',
    'pad',
    'li pt',
    'lh',
    'ratio',
    'contrast',
    'chars',
    'lines',
    'wrap',
    'title',
  ].join(' | '),
);
for (const r of rows) {
  console.log(
    [
      r.theme,
      r.actual,
      r.page,
      r.tag,
      r.cardW + '×' + r.cardH,
      r.pad.replace(/px/g, ''),
      r.size + 'px',
      r.lh,
      r.lhRatio,
      r.contrast + ':1',
      r.chars,
      r.lines,
      r.wrap,
      r.titleSize + 'px ' + r.titleFont + ' "' + r.title + '"',
    ].join(' | '),
  );
}
