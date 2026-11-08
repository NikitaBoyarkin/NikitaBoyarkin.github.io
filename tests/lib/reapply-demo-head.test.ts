import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hasDescription, reapplyHead, siteOwnedHeadTags } from '../../scripts/reapply-demo-head.mjs';

// The deploy workflow re-renders `public/demos/volta-board/index.html` with
// `dct render` on every build, and that render carries only charset, viewport
// and `<title>`. The description, canonical and OG block are site-owned and
// live in the committed copy; `scripts/reapply-demo-head.mjs` is the step that
// puts them back. When it is missing, the /demos/ card for that board renders
// blank and `scanDemos` fails `demos.test.ts:192` — which is exactly how the
// red build of run 42446109157 surfaced.
//
// These cases bind the merge to that contract in both directions: tags must
// arrive, duplicates must not, and a source without a description must fail
// loudly instead of silently shipping an empty card.

const ROOT = resolve(__dirname, '..', '..');
const COMMITTED_BOARD = resolve(ROOT, 'public', 'demos', 'volta-board', 'index.html');

/** What `dct render` 0.9.1 actually emits: charset, viewport, title. */
const RENDERED = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Volta Neobank — core analytics</title>
    <style>body { margin: 0; }</style>
</head>
<body><div class="dbt-charts-wrapper"></div></body>
</html>
`;

const SOURCE = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Volta Neobank — core analytics</title>
    <style>body { margin: 0; }</style>
<meta name="description" content="Volta Neobank core analytics board: onboarding funnel, KYC A/B test, retention, DiD causal check and segmentation, built with dbt Charts.">
<link rel="canonical" href="https://nikitaboyarkin.github.io/demos/volta-board/">
<meta property="og:title" content="Volta Neobank — core analytics">
<meta property="og:url" content="https://nikitaboyarkin.github.io/demos/volta-board/">
</head>
<body></body>
</html>
`;

describe('reapplyHead', () => {
  it('restores the description, canonical and OG tags a bare render lacks', () => {
    const merged = reapplyHead(RENDERED, SOURCE);

    expect(hasDescription(merged)).toBe(true);
    expect(merged).toContain('rel="canonical" href="https://nikitaboyarkin.github.io/demos/volta-board/"');
    expect(merged).toContain('property="og:url"');
    // Still a single <head>, and the tags land inside it, before </head>.
    expect(merged.match(/<head\b/gi)?.length).toBe(1);
    expect(merged.indexOf('name="description"')).toBeLessThan(merged.indexOf('</head>'));
    expect(merged).not.toContain('<meta charset=""');
  });

  it('is idempotent: a second pass adds nothing', () => {
    const once = reapplyHead(RENDERED, SOURCE);
    const twice = reapplyHead(once, SOURCE);

    expect(twice).toBe(once);
    expect(siteOwnedHeadTags(twice).filter((tag) => tag.includes('name="description"')).length).toBe(1);
  });

  it('keeps a tag the render already carries instead of duplicating it', () => {
    const withOwnDescription = RENDERED.replace(
      '</head>',
      '<meta name="description" content="board says this itself">\n</head>',
    );
    const merged = reapplyHead(withOwnDescription, SOURCE);

    expect(merged).toContain('content="board says this itself"');
    expect(merged).not.toContain('Volta Neobank core analytics board: onboarding funnel');
  });

  it('refuses a source with no description rather than shipping a blank card', () => {
    expect(() => reapplyHead(RENDERED, RENDERED)).toThrow(/no <meta name="description">/);
    expect(hasDescription(RENDERED)).toBe(false);
  });
});

describe('the committed board the CI step reads', () => {
  it('carries the site-owned head the deploy would otherwise lose', () => {
    const committed = readFileSync(COMMITTED_BOARD, 'utf8');
    const tags = siteOwnedHeadTags(committed);
    const keys = tags.map((tag) => tag.toLowerCase());

    expect(hasDescription(committed)).toBe(true);
    expect(keys.some((tag) => tag.includes('rel="canonical"'))).toBe(true);
    expect(keys.some((tag) => tag.includes('property="og:title"'))).toBe(true);
    expect(keys.some((tag) => tag.includes('property="og:url"'))).toBe(true);
  });
});
