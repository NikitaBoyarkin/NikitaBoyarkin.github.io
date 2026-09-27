// Temporary: paired crop of the first project prose paragraph, to compare with
// before-prose-crop.png (1472x112 = 736px x 56 CSS at 2x).
import { chromium } from 'playwright';

const BASE = `http://localhost:${process.env.PORT || 4399}`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => localStorage.setItem('theme', 'dark'));
const page = await ctx.newPage();

await page.goto(`${BASE}/projects/posthog/`, { waitUntil: 'networkidle' });
const p = page.locator('#project-content > p').first();
const box = await p.boundingBox();
console.log('posthog #project-content > p:', JSON.stringify(box));
await p.screenshot({ path: 'reports/readability/after-prose-crop.png' });

await browser.close();
