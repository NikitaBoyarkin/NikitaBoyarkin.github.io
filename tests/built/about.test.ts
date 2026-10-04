// /about invariants that fail *silently* when a redesign lands.
//
//   1. Seven deep-link redirects in astro.config.mjs point at #who / #work /
//      #now / #start. Rename an anchor and the redirect still returns 308 —
//      it just lands on the top of the page. Nothing else checks that.
//   2. Analytics.astro emits `section_viewed` from [data-analytics-section].
//      Dropping the attribute kills the event with no error anywhere.
//   3. The CV link is documented in docs/cta-inventory.md as carrying
//      cv_download_pdf; it did not, so the download was invisible.
//   4. The ProfilePage Person node is what makes the page useful to a
//      knowledge panel; the enriching fields are easy to lose in a rewrite.
//
// Requires `bun run build` first (reads dist/).

import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const DIST = resolve(ROOT, 'dist');

const PAGES = [
  { label: 'RU about', path: '/about/index.html' },
  { label: 'EN about', path: '/en/about/index.html' },
];

/** Anchors the redirect map in astro.config.mjs resolves to. */
const REDIRECT_ANCHORS = ['start', 'who', 'now', 'work'];

/** Values Analytics.astro observes via [data-analytics-section]. */
const ANALYTICS_SECTIONS = ['who', 'how', 'now', 'work', 'location'];

function page(path: string): string {
  const file = resolve(DIST, `.${path}`);
  if (!existsSync(file)) {
    throw new Error(`dist${path} missing — run \`bun run build\` first`);
  }
  return readFileSync(file, 'utf8');
}

/** Every JSON-LD node embedded in a page (a page emits several scripts). */
function jsonLdNodes(html: string): Array<Record<string, unknown>> {
  const nodes: Array<Record<string, unknown>> = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  for (const m of html.matchAll(re)) {
    try {
      nodes.push(JSON.parse(m[1]) as Record<string, unknown>);
    } catch {
      // A malformed block is caught by its own assertion below.
    }
  }
  return nodes;
}

describe.each(PAGES)('about page contract ($label)', ({ path }) => {
  let html = '';

  beforeAll(() => {
    html = page(path);
  });

  it('keeps every anchor the redirect map points at', () => {
    for (const id of REDIRECT_ANCHORS) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it('mounts the experience & education block', () => {
    expect(html).toContain('id="career"');
  });

  it('keeps the section_viewed anchors', () => {
    for (const section of ANALYTICS_SECTIONS) {
      expect(html).toContain(`data-analytics-section="${section}"`);
    }
  });

  it('tags the CV link so the download is measurable', () => {
    const cvLink = /<a[^>]*download[^>]*>/.exec(html)?.[0] ?? '';
    expect(cvLink).not.toBe('');
    expect(cvLink).toContain('data-analytics="cv_download_pdf"');
  });

  it('keeps the AskMe widget (asserted by morph.test.ts)', () => {
    expect(html).toContain('AskMe.astro_astro_type_script_index_0_lang');
  });

  it('emits a ProfilePage Person with knowsAbout and alumniOf', () => {
    const profile = jsonLdNodes(html).find((n) => n['@type'] === 'ProfilePage');
    expect(profile).toBeDefined();

    const person = profile?.mainEntity as Record<string, unknown> | undefined;
    expect(person?.['@type']).toBe('Person');
    expect(Array.isArray(person?.knowsAbout)).toBe(true);
    expect((person?.knowsAbout as unknown[]).length).toBeGreaterThan(0);
    expect(Array.isArray(person?.alumniOf)).toBe(true);
    expect((person?.alumniOf as unknown[]).length).toBeGreaterThan(0);
  });
});
