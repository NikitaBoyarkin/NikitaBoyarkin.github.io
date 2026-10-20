#!/usr/bin/env node
/**
 * audit-palette-coverage.mjs — Phase 2 visual audit (PRD Goal 1).
 *
 * Loads the home page in each theme (dark/light/cyberpunk) at 3 breakpoints,
 * captures a viewport screenshot, and classifies every sampled pixel into a
 * 60/30/10 palette bucket by nearest palette hex (Euclidean RGB). Pixels too
 * far from any palette hex → "other" (photos, WebGL shader, anti-alias edges).
 *
 * Reports % of total screen and % within palette. The 60-30-10 budget check
 * (60 ∈ [55,65], 30 ∈ [25,35], 10 ≤ 15) uses palette-pixel share, since
 * photos/shader are imagery, not color-scheme. Writes screenshots + summary.json
 * to reports/palette-audit/.
 *
 * Verified evidence (evidence-ledger): real rendered pixels, not a CSS proxy.
 * Caveat: the IntroShader WebGL hero may render via swiftshader in headless;
 * if it falls back to the page background, "other" is under-counted and the
 * 60% surface is slightly over-counted. See notes in summary.json.
 */
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

const BASE = process.env.BASE_URL || 'http://localhost:4321';
const OUT = 'reports/palette-audit';
const THRESH = 25;   // max Euclidean RGB distance to count as a palette color
const STEP = 2;      // sample every Nth pixel per dimension (4x downsample at 2)

// Palette per theme, grouped into the 60/30/10 roles the site actually ships
// (DESIGN.md "Color Roles — 60-30-10"). The 10% bucket is the accent family:
// the coral/sienna text accent plus the orange/magenta button fill, not the
// retired coral (#ff6643 / #e0532f). The dataviz highlight is classified with
// the accent so its pixels are not dumped into "other" — it is information, not
// a second surface, and keeping it out of the 60% teal bucket is the honest
// choice. Bound to the tokens by tests/lib/demo-tokens.test.ts + brand.test.ts.
const palettes = {
  dark: {
    '60': ['1400c3', '16009f', '120093', '0d0068'],
    '30': ['e4e4e7', 'b3b3ba', '8076d7'],
    '10': ['ff8569', 'ffa68a', 'fe4e02', 'ff6a1f', '4ecdc4'],
  },
  light: {
    '60': ['f4efca', 'ffffff', 'f8f2da', 'f4f4f5'],
    '30': ['18181b', '52525b', 'e4e4e7', 'd4d4d8'],
    '10': ['a8331a', '8a2a16', 'fe4e02', 'ff6a1f', '0d7377'],
  },
  cyberpunk: {
    '60': ['0a0a12', '11111d', '1a1a2e'],
    '30': ['e6f1ff', '8a8aa8', '2a2a4a', '16162e'],
    '10': ['ff8569', 'ffbe99', 'ff2bd6', 'ff5ce0', '4ecdc4'],
  },
};

function buildRoleList(p) {
  const list = [];
  for (const role of ['60', '30', '10']) {
    for (const hex of p[role]) {
      const n = parseInt(hex, 16);
      list.push({ r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, role });
    }
  }
  return list;
}

function classify(png, roleList) {
  const counts = { '60': 0, '30': 0, '10': 0, other: 0 };
  const { width, height, data } = png;
  let total = 0;
  for (let y = 0; y < height; y += STEP) {
    for (let x = 0; x < width; x += STEP) {
      const idx = (y * width + x) << 2;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      let best = Infinity, bestRole = 'other';
      for (const c of roleList) {
        const dr = r - c.r, dg = g - c.g, db = b - c.b;
        const d = dr * dr + dg * dg + db * db;
        if (d < best) { best = d; bestRole = c.role; }
      }
      if (Math.sqrt(best) <= THRESH) counts[bestRole]++;
      else counts.other++;
      total++;
    }
  }
  return { counts, total };
}

const breakpoints = [
  { name: 'desktop', w: 1440, h: 900 },
  { name: 'tablet', w: 768, h: 1024 },
  { name: 'mobile', w: 375, h: 812 },
];

const inRange = (v, lo, hi) => v >= lo && v <= hi;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const results = [];

  for (const theme of ['dark', 'light', 'cyberpunk']) {
    const roleList = buildRoleList(palettes[theme]);
    const context = await browser.newContext();
    await context.addInitScript((t) => {
      try { localStorage.setItem('theme', t); } catch (e) {}
    }, theme);
    const page = await context.newPage();

    for (const bp of breakpoints) {
      await page.setViewportSize({ width: bp.w, height: bp.h });
      await page.goto(BASE + '/', { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(1800); // settle shader + reveal animations + fonts

      const pngBuf = await page.screenshot({ type: 'png' });
      const file = path.join(OUT, `${theme}-${bp.name}-${bp.w}x${bp.h}.png`);
      fs.writeFileSync(file, pngBuf);

      const png = PNG.sync.read(pngBuf);
      const { counts, total } = classify(png, roleList);
      const palPx = counts['60'] + counts['30'] + counts['10'];
      const pct = (n) => (100 * n / total);
      const pctPal = (n) => (100 * n / palPx);

      const p60 = pctPal(counts['60']);
      const p30 = pctPal(counts['30']);
      const p10 = pctPal(counts['10']);

      results.push({
        theme,
        breakpoint: bp.name,
        dims: `${bp.w}x${bp.h}`,
        total_sampled_px: total,
        palette_px: palPx,
        share_of_screen: { '60': +pct(counts['60']).toFixed(1), '30': +pct(counts['30']).toFixed(1), '10': +pct(counts['10']).toFixed(1), other: +pct(counts.other).toFixed(1) },
        share_of_palette: { '60': +p60.toFixed(1), '30': +p30.toFixed(1), '10': +p10.toFixed(1) },
        budget_verdict: {
          '60': inRange(p60, 55, 65) ? 'PASS' : 'CHECK',
          '30': inRange(p30, 25, 35) ? 'PASS' : 'CHECK',
          '10': p10 <= 15 ? 'PASS' : 'CHECK',
        },
        screenshot: file,
      });
    }
    await context.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(results, null, 2));

  console.log('\n=== PALETTE COVERAGE — share of palette (budget check) ===');
  console.log('theme       breakpoint   60%     30%     10%     other(screen)  verdict(60/30/10)');
  for (const r of results) {
    console.log(
      `${r.theme.padEnd(11)} ${r.breakpoint.padEnd(12)} ` +
      `${String(r.share_of_palette['60']).padStart(5)}   ${String(r.share_of_palette['30']).padStart(5)}   ${String(r.share_of_palette['10']).padStart(5)}   ${String(r.share_of_screen.other).padStart(6)}        ` +
      `${r.budget_verdict['60']}/${r.budget_verdict['30']}/${r.budget_verdict['10']}`
    );
  }
  console.log(`\nScreenshots + summary.json → ${OUT}/`);
})();