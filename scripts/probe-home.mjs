/** One-off probe: skeleton frames, page height, mobile controls. */
import { chromium } from 'playwright';

const BASE = 'http://localhost:4321';
const browser = await chromium.launch();

// --- desktop ---
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('theme', 'dark');
  } catch {
    /* ignore */
  }
});
const page = await ctx.newPage();
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const out = await page.evaluate(() => {
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  };
  const vpEl = document.querySelector('.canvas-viewport');
  const frames = [...document.querySelectorAll('.canvas-sketch [data-frame]')].map((g) => {
    const b = g.getBBox();
    return {
      id: g.getAttribute('data-frame'),
      x: Math.round(b.x),
      y: Math.round(b.y),
      w: Math.round(b.width),
      h: Math.round(b.height),
      paths: g.querySelectorAll('path').length,
      opacity2: getComputedStyle(g.querySelector("path[data-pass='1']") || g).opacity,
    };
  });
  const nodeRects = [...document.querySelectorAll('[data-node]')].map((el) => ({
    id: el.getAttribute('data-node'),
    text: (el.textContent || '').trim().slice(0, 24),
    scrollW: el.scrollWidth,
    clientW: el.clientWidth,
    overflowX: el.scrollWidth > el.clientWidth + 1,
  }));
  const kids = [...document.body.children].map((el) => ({
    tag: el.tagName,
    cls: el.className && typeof el.className === 'string' ? el.className.slice(0, 40) : '',
    rect: r(el),
  }));
  return {
    docH: document.documentElement.scrollHeight,
    vpRect: r(vpEl),
    htmlClass: document.documentElement.className,
    frames,
    overflowing: nodeRects.filter((n) => n.overflowX),
    bodyChildren: kids,
  };
});
console.log('=== DESKTOP 1440x900 ===');
console.log(JSON.stringify(out, null, 1));
await ctx.close();

// --- mobile ---
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await mctx.addInitScript(() => {
  try {
    localStorage.setItem('theme', 'dark');
  } catch {
    /* ignore */
  }
});
const mpage = await mctx.newPage();
await mpage.goto(BASE + '/', { waitUntil: 'networkidle' });
await mpage.waitForTimeout(400);
const m = await mpage.evaluate(() => {
  const c = document.querySelector('.canvas-controls');
  const b = c?.getBoundingClientRect();
  return {
    htmlClass: document.documentElement.className,
    controlsDisplay: c ? getComputedStyle(c).display : 'absent',
    controlsRect: b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null,
    docH: document.documentElement.scrollHeight,
  };
});
console.log('=== MOBILE 390x844 ===');
console.log(JSON.stringify(m, null, 1));

await browser.close();
