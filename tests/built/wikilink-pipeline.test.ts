import { describe, it, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The wikilink feature shipped on 2026-10-31 and was inert in production: every
// `[[…]]` in the content sat inside a code span, where mdast yields `inlineCode`
// and the plugin never runs. The first live link (projects/volta.md → the Volta
// case study) then exposed a second, worse failure — the glossary linker ran
// first, split the text node around the term inside the link *label*, and the
// wikilink regex could no longer match, so literal `[[slug|label]]` shipped.
//
// These assertions bind that pipeline order. They are on the built page, not on
// the plugin, because the plugin was already unit-tested and green while the
// shipped HTML was broken.

const ROOT = resolve(__dirname, '..', '..');
const PAGE = resolve(ROOT, 'dist/projects/volta/index.html');

describe('live wikilink survives the mdast pipeline', () => {
  if (!existsSync(PAGE)) throw new Error('dist/ missing — run `bun run build` first');
  const html = readFileSync(PAGE, 'utf8');

  it('renders the wikilink as an anchor carrying the pipe label', () => {
    expect(html).toContain('<a href="/posts/volta-neobank-case-study/">«Кейс Volta:');
  });

  it('leaves no literal brackets behind', () => {
    expect(html).not.toContain('[[volta-neobank-case-study');
  });

  it('still auto-links glossary terms on the same page', () => {
    // If the plugin order is flipped back, the wikilink breaks; if the glossary
    // linker is dropped entirely, this fails. Both directions are covered.
    expect(html).toMatch(/href="\/glossary\/[a-z-]+\/"/);
  });
});
