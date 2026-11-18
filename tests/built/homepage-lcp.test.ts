// Case-page lead regression: the lead renders exactly one media element, and the
// head preload must name it — or not exist at all.
//
// Two shapes exist since the lead became the case's own board:
//
//   * a case whose `demo:` is same-origin renders the board <iframe> in the lead
//     and no hero <img>; there is nothing to preload, so a leftover
//     `<link rel="preload" as="image">` would only cost a wasted request;
//   * a case whose `demo:` is a third-party URL (or that has no demo) still leads
//     with the hero art, and the preload href must equal its <img src> — a
//     mismatch makes the browser fetch the image twice instead of once.
//
// The claim has moved three times. `/` became the persona gate, so the editorial
// hero — and this claim with it — moved to the colleague version; on 2026-11-15
// that became a tab panel of `/hire/`; on 2026-11-16 the colleague lane dropped its
// featured case entirely. Then on 2026-11-19 the frameable board replaced the hero
// on 25 case pages, which is why this file now asserts both shapes instead of one.
//
// Requires `bun run build` first (reads dist/).

import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');

/** Cases whose lead is still the hero art: `demo:` is an absolute third-party URL. */
const HERO_PAGES = ['projects/mm-program-page/index.html', 'en/projects/mm-program-page/index.html'];

/** Cases whose lead is the same-origin board: no hero art, no image preload. */
const BOARD_PAGES = ['projects/volta/index.html', 'en/projects/volta/index.html'];

const PAGES = [...HERO_PAGES, ...BOARD_PAGES];

const html = new Map<string, string>();

beforeAll(() => {
  if (!existsSync(resolve(DIST, 'index.html'))) {
    throw new Error('dist/ missing — run `bun run build` first');
  }
  for (const file of PAGES) {
    const path = resolve(DIST, file);
    if (!existsSync(path)) throw new Error(`built page missing: ${file}`);
    html.set(file, readFileSync(path, 'utf8'));
  }
});

describe('hero lead', () => {
  for (const file of HERO_PAGES) {
    it(`${file} preloads the LCP image with high priority`, () => {
      const doc = html.get(file)!;
      const preload = doc.match(/<link rel="preload" as="image"[^>]*>/)?.[0];
      expect(preload).toBeDefined();
      expect(preload).toContain('fetchpriority="high"');

      // The preloaded href must equal the hero <img> src — a mismatch makes the
      // browser fetch the image twice instead of once.
      const href = /href="([^"]+)"/.exec(preload!)?.[1];
      expect(href).toBeDefined();
      const imgSrc = doc.match(/class="hero-image"[^>]*>/)?.[0];
      expect(imgSrc).toContain(`src="${href}"`);
    });
  }
});

describe('board lead', () => {
  for (const file of BOARD_PAGES) {
    it(`${file} leads with the live board and preloads no hero`, () => {
      const doc = html.get(file)!;

      const frame = doc.match(/<iframe[^>]*class="project-demo-frame"[^>]*>/)?.[0];
      expect(frame).toBeDefined();
      expect(frame).toContain('src="/demos/');

      // The board replaced the art, so neither the image nor its preload may
      // survive: a head preload here would name an element the page dropped.
      expect(doc).not.toContain('class="hero-image"');
      expect(doc).not.toMatch(/<link rel="preload" as="image"/);
    });
  }
});
