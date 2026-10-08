// Landing LCP regression: the featured-case image is the largest-contentful
// element on `/colleague/` and `/en/colleague/`, and it is fetched late unless a
// head preload names it. When the preload is dropped (or its href drifts from the
// <img src>), the page silently falls back to a ~1 s FCP→LCP gap — no unit test and
// no lint would catch it, only a Lighthouse run against production would.
//
// The pages moved: `/` is now the persona gate, which carries no hero image, so
// the editorial hero — and this claim with it — lives on the colleague version.
//
// Requires `bun run build` first (reads dist/).

import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');

/** The role landings that carry the featured-case split (RU + EN). */
const HOMEPAGES = ['colleague/index.html', 'en/colleague/index.html'];

const html = new Map<string, string>();

beforeAll(() => {
  if (!existsSync(resolve(DIST, 'index.html'))) {
    throw new Error('dist/ missing — run `bun run build` first');
  }
  for (const file of HOMEPAGES) {
    html.set(file, readFileSync(resolve(DIST, file), 'utf8'));
  }
});

describe('homepage hero preload', () => {
  for (const file of HOMEPAGES) {
    it(`${file} preloads the LCP image with high priority`, () => {
      const doc = html.get(file)!;
      const preload = doc.match(/<link rel="preload" as="image"[^>]*>/)?.[0];
      expect(preload).toBeDefined();
      expect(preload).toContain('fetchpriority="high"');

      // The preloaded href must equal the hero <img> src — a mismatch makes the
      // browser fetch the image twice instead of once.
      const href = /href="([^"]+)"/.exec(preload!)?.[1];
      expect(href).toBeDefined();
      const imgSrc = doc.match(/class="featured-card-image"[^>]*>/)?.[0];
      expect(imgSrc).toContain(`src="${href}"`);
    });
  }
});
