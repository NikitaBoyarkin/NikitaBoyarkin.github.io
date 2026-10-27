import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:4399';
const browser = await chromium.launch();
const p = await (await browser.newContext({ viewport: { width: 1000, height: 950 } })).newPage();
await p.goto(BASE + '/posts/bayesian-ab-testing/', { waitUntil: 'load' });
await p.waitForTimeout(500);
// focus the track directly (as a scrollable it may be keyboard focusable)
const r = await p.evaluate(async () => {
  const track = document.querySelector('.reader-track[data-carousel-track]');
  track.tabIndex = track.tabIndex; // no-op, do not add
  track.focus();
  const before = track.scrollLeft;
  return { tabIndexAttr: track.getAttribute('tabindex'), matchesFocus: document.activeElement === track, before };
});
await p.keyboard.press('ArrowRight');
await p.waitForTimeout(600);
const after = await p.evaluate(() => {
  const t = document.querySelector('.reader-track[data-carousel-track]');
  return { scrollLeft: Math.round(t.scrollLeft), active: document.activeElement?.className || document.activeElement?.tagName };
});
// Tab-walk from the top of the page and see whether the track is ever the focused element
await p.goto(BASE + '/posts/bayesian-ab-testing/', { waitUntil: 'load' });
await p.waitForTimeout(300);
let reachedTrack = false, tabs = 0;
for (let i = 0; i < 80; i++) {
  await p.keyboard.press('Tab');
  tabs++;
  const hit = await p.evaluate(() => document.activeElement?.classList?.contains('reader-track') ?? false);
  if (hit) { reachedTrack = true; break; }
}
await p.keyboard.press('ArrowRight');
await p.waitForTimeout(500);
const sl = await p.evaluate(() => Math.round(document.querySelector('.reader-track').scrollLeft));
console.log(JSON.stringify({ ...r, ...after, reachedTrack, tabs, scrollLeftAfterTabArrow: sl }));
await browser.close();
