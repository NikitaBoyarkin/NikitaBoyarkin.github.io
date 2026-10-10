/** One-off: PRD §8 checks 4/5/6/10 — computed tokens + mobile overflow. */
import { chromium } from 'playwright';
const BASE = 'http://localhost:4321';
const b = await chromium.launch();

for (const theme of ['dark', 'light']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
  const p = await ctx.newPage();
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const o = await p.evaluate(() => {
    const cs = (s, prop) => {
      const el = document.querySelector(s);
      return el ? getComputedStyle(el)[prop] : 'ABSENT';
    };
    const card = document.querySelector('.persona-card');
    return {
      blurbColor: cs('.persona-card-blurb', 'color'),
      cardBg: cs('.persona-card', 'backgroundImage').slice(0, 90),
      heroRole: cs('.hero-role', 'color'),
      sketchStroke: cs('.canvas-sketch', 'stroke'),
      sketchOpacity: cs('.canvas-sketch', 'strokeOpacity'),
      steps: [...document.querySelectorAll('.persona-card-step')].map((e) => e.textContent),
      stepAria: document.querySelector('.persona-card-step')?.getAttribute('aria-hidden'),
      frames: [...document.querySelectorAll('[data-frame]')].map((g) => g.getAttribute('data-frame')),
      cardBorder: cs('.persona-card', 'borderTopColor'),
      ctaRailCoral: cs('.persona-card-cta', 'color'),
      // any element still painting --border-active as a *background* (decor)
      bgAccent: [...document.querySelectorAll('.canvas-nodes *')]
        .filter((e) => {
          const s = getComputedStyle(e);
          return /255,\s*133,\s*105/.test(s.backgroundColor) || /255,\s*133,\s*105/.test(s.backgroundImage);
        })
        .map((e) => e.className)
        .slice(0, 8),
      card: card ? { w: card.getBoundingClientRect().width } : null,
      // §8.1 / §8.2 — the composition claims. Screen tops of every node plus the
      // fork lead-in, and the two column floors.
      rects: [...document.querySelectorAll('[data-node], .canvas-lead')].map((e) => {
        const r = e.getBoundingClientRect();
        return {
          id: e.dataset.node || 'canvas-lead',
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
        };
      }),
    };
  });
  console.log('=== ' + theme.toUpperCase() + ' ===');
  console.log(JSON.stringify(o, null, 1));
  await ctx.close();
}

// §8.10 — no node wider than the viewport, nothing outside the world
for (const w of [375, 390, 412]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  const o = await p.evaluate(() => {
    const nodes = [...document.querySelectorAll('.canvas-node')];
    return {
      docW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      widest: Math.max(...nodes.map((n) => Math.round(n.getBoundingClientRect().width))),
      overflowing: nodes.filter((n) => n.scrollWidth > n.clientWidth + 1).map((n) => n.dataset.node),
      world: document.querySelector('.canvas-world')?.getBoundingClientRect().width,
    };
  });
  console.log(w, JSON.stringify(o));
  await ctx.close();
}
await b.close();
