/**
 * Screenshot the homepage in all three themes at desktop + mobile.
 * Usage: bun run scripts/shot-home.mjs [outDir]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.argv[2] || 'reports/home-shots';
const BASE = process.env.BASE_URL || 'http://localhost:4321';
const VIEWS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const theme of ['dark', 'light', 'cyberpunk']) {
  for (const v of VIEWS) {
    const ctx = await browser.newContext({
      viewport: { width: v.width, height: v.height },
      deviceScaleFactor: 2,
      colorScheme: theme === 'light' ? 'light' : 'dark',
    });
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('theme', t);
      } catch {
        /* ignore */
      }
    }, theme);
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${theme}-${v.name}.png` });
    if (v.name === 'desktop') {
      const m = await page.evaluate(() => {
        const q = (s) => document.querySelector(s)?.getBoundingClientRect();
        const pick = (r) =>
          r && { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
        return {
          viewport: document.querySelector('.canvas-viewport')?.getAttribute('class'),
          world: pick(q('.canvas-world')),
          h1: pick(q('h1')),
          claim: pick(q('[data-node="claim"]')),
          booking: pick(q('[data-node="cta-booking"]')),
          cv: pick(q('[data-node="cta-cv"]')),
          lead: pick(q('.canvas-lead')),
          roleHr: pick(q('[data-node="role-hr"]')),
          roleManager: pick(q('[data-node="role-manager"]')),
          roleColleague: pick(q('[data-node="role-colleague"]')),
          all: pick(q('[data-node="projects-all"]')),
          vpVars: (() => {
            const el = document.querySelector('.canvas-world');
            if (!el) return null;
            const cs = getComputedStyle(el);
            return {
              tx: cs.getPropertyValue('--vp-tx').trim(),
              ty: cs.getPropertyValue('--vp-ty').trim(),
              k: cs.getPropertyValue('--vp-k').trim(),
            };
          })(),
          docH: document.documentElement.scrollHeight,
          bodyOverflowX: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      console.log(theme, JSON.stringify(m, null, 1));
    }
    await ctx.close();
  }
}
await browser.close();
console.log('shots →', OUT);
