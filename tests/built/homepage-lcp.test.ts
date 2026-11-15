// Case-page LCP regression: the hero image is the largest-contentful element on a
// case page, and it is fetched late unless a head preload names it. When the
// preload is dropped (or its href drifts from the <img src>), the page silently
// falls back to a ~1 s FCP→LCP gap — no unit test and no lint would catch it, only
// a Lighthouse run against production would.
//
// The claim has moved twice. `/` became the persona gate, so the editorial hero —
// and this claim with it — moved to the colleague version; on 2026-11-15 that became
// a tab panel of `/hire/`. On 2026-11-16 the colleague lane dropped its featured
// case entirely (the lane opens onto section cards), which left the preload naming
// an image the merged page no longer renders. The largest such image that is still
// preloaded is the case-page hero, so the claim lives here now: same equivalence
// (preload href === hero <img> src), one host instead of a dead one.
//
// Requires `bun run build` first (reads dist/).

import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');

/** The case page whose head preloads its own hero image (RU + EN). */
const PAGES = ['projects/volta/index.html', 'en/projects/volta/index.html'];

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

describe('case page hero preload', () => {
  for (const file of PAGES) {
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
