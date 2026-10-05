import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const out = '/tmp/proj-shots';
mkdirSync(out, { recursive: true });

const url = process.env.URL || 'http://localhost:4321/projects/';
const full = process.env.FULL === '1';

const browser = await chromium.launch();

for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
    colorScheme: theme === 'light' ? 'light' : 'dark',
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${theme}-viewport.png` });
  if (full) await page.screenshot({ path: `${out}/${theme}-full.png`, fullPage: true });
  await ctx.close();
}

// Measure the board geometry in both themes
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
const measure = async (theme) => {
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await page.waitForTimeout(250);
  return page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x) };
  };
  const rgb = (s) => {
    const m = s.match(/[\d.]+/g);
    return m ? { r: +m[0], g: +m[1], b: +m[2], a: m[3] === undefined ? 1 : +m[3] } : null;
  };
  const lum = ({ r, g, b }) => {
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const ratio = (fg, bg) => {
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return +((a + 0.05) / (b + 0.05)).toFixed(2);
  };

  const card = q('.project');
  const cs = card ? getComputedStyle(card) : null;
  const pageBg = rgb(getComputedStyle(document.body).backgroundColor);
  const cardBg = cs?.backgroundColor ? over(rgb(cs.backgroundColor), pageBg) : pageBg;
  const badge = q('.project-track-badge');
  const badgeColor = badge ? rgb(getComputedStyle(badge).color) : null;

  return {
    main: box(q('main')),
    pageTitle: box(q('.page-title')),
    intro: box(q('.page-intro')),
    filterBar: box(q('.project-filter-bar')),
    grid: box(q('#project-list')),
    gridCols: q('#project-list') ? getComputedStyle(q('#project-list')).gridTemplateColumns : null,
    firstCardY: Math.round(card.getBoundingClientRect().top + window.scrollY),
    card: box(card),
    cardPadding: cs?.padding,
    cardRadius: cs?.borderRadius,
    cardBg: cs?.backgroundColor,
    cardBorder: cs?.borderColor,
    imgRatio: q('.project img')
      ? +(q('.project img').getBoundingClientRect().width / q('.project img').getBoundingClientRect().height).toFixed(3)
      : null,
    imgH: box(q('.project img'))?.h,
    badgeText: badge?.textContent,
    /** WCAG AA: text 4.5, large/UI 3.0. */
    contrast: {
      badgeOnCard: badgeColor ? ratio(over(badgeColor, cardBg), cardBg) : null,
      bodyTextOnCard: ratio(over(rgb(cs.color), cardBg), cardBg),
      mutedLinkOnCard: ratio(over(rgb(getComputedStyle(q('.project-action-link')).color), cardBg), cardBg),
    },
    projectCount: document.querySelectorAll('.project').length,
    h1Font: getComputedStyle(q('.page-title')).fontFamily,
    h1Size: getComputedStyle(q('.page-title')).fontSize,
    h3Font: getComputedStyle(q('.project h3')).fontFamily,
    h3Size: getComputedStyle(q('.project h3')).fontSize,
  };
  });
};

for (const theme of ['dark', 'light']) {
  console.log(`--- ${theme} ---`);
  console.log(JSON.stringify(await measure(theme), null, 2));
}

await browser.close();
