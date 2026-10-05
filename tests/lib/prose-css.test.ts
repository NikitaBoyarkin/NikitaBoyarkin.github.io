import { describe, it, expect } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Binds the prose layer documented in `docs/prd-readability.md` (D16, as amended)
 * to a mechanism.
 *
 * The change this guards is a *deletion*: ~300 lines of prose rules were removed
 * from `global.css` and `blog.css` and replaced by `src/styles/prose.css`, whose
 * selectors are class-scoped. Nothing about that deletion is visible at runtime
 * — a stylesheet that silently lost its heading or table rules still builds, still
 * passes every other test, and still ships 135 green pages. Hence this file.
 *
 * What fails when the claim stops being true:
 *  - a prose rule re-added under the old `#project-content` / `.post-content`
 *    selectors (it would win on specificity and shadow the new layer)
 *  - a wiring site losing `class="prose"`, or losing the id it must keep —
 *    `InnerTOC.astro` defaults to `#project-content`, `Post.astro` passes
 *    `#post-content`, and `tests/built/toc.test.ts` asserts both in built HTML
 *  - a hex literal creeping into `prose.css`, which would take colour out of the
 *    per-theme tokens and off `.claude/hooks/contrast-gate.js`'s inputs (that
 *    hook resolves only solid hex and reads only global.css)
 *  - `prose.css` being imported before the sheets it must win against
 *
 * NOT bound here: the rendered result (does the heading actually look right,
 * is the measure actually ~75ch). That is «Verified by eye» in the PRD, not a test.
 */

const ROOT = path.resolve(import.meta.dir, '../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Comments are dropped so prose that *talks about* the old selectors is not a hit. */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const PROSE = 'src/styles/prose.css';
const GLOBAL = 'src/styles/global.css';
const BLOG = 'src/styles/blog.css';

/**
 * Every surface that renders Markdown, the attribute it must carry, and the id it
 * must keep. The id is load-bearing; the class is what styles.
 */
const WIRING_SITES: Array<[file: string, markup: string]> = [
  ['src/pages/projects/[slug].astro', '<article id="project-content" class="prose">'],
  ['src/pages/en/projects/[slug].astro', '<article id="project-content" class="prose">'],
  ['src/pages/projects/volta/[part].astro', '<article id="project-content" class="prose">'],
  ['src/pages/en/projects/volta/[part].astro', '<article id="project-content" class="prose">'],
  ['src/layouts/Post.astro', '<div class="post-body prose" id="post-content">'],
];

describe('prose layer', () => {
  it('has a stylesheet that defines the measure tokens and the .prose root', () => {
    const css = stripComments(read(PROSE));
    expect(css).toContain('.prose {');
    for (const token of ['--prose-measure', '--prose-size', '--prose-lh', '--prose-indent']) {
      expect(css).toMatch(new RegExp(`${token}\\s*:`));
    }
    // The measure is a `ch` value, which only resolves correctly because the size
    // lives on the same element — see the trap documented in the sheet itself.
    expect(css).toMatch(/--prose-measure:\s*[\d.]+ch/);
    expect(css).toMatch(/\.prose\s*\{[^}]*max-width:\s*var\(--prose-measure\)/);
    expect(css).toMatch(/\.prose\s*\{[^}]*font-size:\s*var\(--prose-size\)/);
  });

  it('keeps every colour on a theme token, so contrast-gate stays on its inputs', () => {
    const css = stripComments(read(PROSE));
    const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hex).toEqual([]);
  });

  it('covers the elements the content actually contains', () => {
    const css = stripComments(read(PROSE));
    for (const sel of [
      '.prose > h1:first-child', // the page heading that had no rule at all
      '.prose h2',
      '.prose h3',
      '.prose p',
      '.prose p + p',
      '.prose a',
      '.prose pre',
      '.prose table',
      '.prose details',
      '.prose summary',
      '.prose iframe',
      '.prose img',
    ]) {
      expect(css).toContain(sel);
    }
    // The scroll + fade-hint recipe for wide tables, at the narrow breakpoint.
    expect(css).toMatch(/@media \(max-width: 768px\)\s*\{[\s\S]*?\.prose table[\s\S]*?overflow-x: auto/);
    expect(css).toMatch(/background-attachment|no-repeat local/);
  });

  it('is imported last, so equal-specificity rules resolve to it', () => {
    const base = read('src/layouts/Base.astro');
    const global = base.indexOf("styles/global.css");
    const blog = base.indexOf("styles/blog.css");
    const prose = base.indexOf("styles/prose.css");
    expect(global).toBeGreaterThan(-1);
    expect(blog).toBeGreaterThan(global);
    expect(prose).toBeGreaterThan(blog);
  });
});

describe('migration — the old ID-scoped blocks are gone, not duplicated', () => {
  // A surviving rule under these selectors outranks `.prose …` at any load order
  // (1-0-0 beats 0-1-0), so a single leftover silently reverts that element.
  it.each([
    [GLOBAL, ['#project-content']],
    [BLOG, ['.post-content h2', '.post-content p', '.post-content pre', '.post-content code', '.post-content li', '.post-content a']],
  ])('%s carries no prose element rules left behind', (file, forbidden) => {
    const css = stripComments(read(file));
    for (const sel of forbidden) {
      expect(css).not.toContain(sel);
    }
  });

  it('keeps the post column aligned with the prose measure', () => {
    const css = stripComments(read(BLOG));
    // Both declarations are required: `ch` resolves against this element's own size.
    expect(css).toMatch(/\.post-content\s*\{[^}]*max-width:\s*var\(--prose-measure\)/);
    expect(css).toMatch(/\.post-content\s*\{[^}]*font-size:\s*var\(--prose-size\)/);
  });

  it('drops the dead rules the migration replaced', () => {
    expect(stripComments(read(GLOBAL))).not.toContain('#project-title');
    expect(stripComments(read(BLOG))).not.toContain('.now-section');
  });
});

describe('wiring — the class styles, the id stays', () => {
  it.each(WIRING_SITES)('%s renders it', (file, markup) => {
    expect(read(file)).toContain(markup);
  });

  it('binds each container width modifier to its page set', () => {
    const css = stripComments(read(GLOBAL));
    expect(css).toMatch(/\.container\s*\{[^}]*max-width:\s*var\(--container-max,\s*800px\)/);
    expect(css).toMatch(/\.container-wide\s*\{\s*--container-max:\s*880px/);
    expect(css).toMatch(/\.container-content\s*\{\s*--container-max:\s*var\(--content-max\)/);

    // Both modifiers are scoped on purpose. The remaining `.container` page
    // (topics) keeps the 800px column.
    const pages = fs
      .readdirSync(path.join(ROOT, 'src/pages'), { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.astro'))
      .map((f) => `src/pages/${f}`);
    const wide = pages.filter((f) => read(f).includes('container-wide'));
    expect(wide.sort()).toEqual(
      [
        'src/pages/en/projects/[slug].astro',
        'src/pages/en/projects/volta/[part].astro',
        'src/pages/projects/[slug].astro',
        'src/pages/projects/volta/[part].astro',
      ].sort(),
    );

    // About keeps its body in src/components/, so the scan has to span both.
    // The shelf *index* is a tile grid and takes the same full reading frame as
    // /graph/ — a grid in the 800px column reads cramped. Only the source pages,
    // which are prose, narrow to the reading measure.
    const content = [...pages, 'src/components/AboutPage.astro'].filter((f) =>
      read(f).includes('container-content'),
    );
    expect(content.sort()).toEqual(
      [
        'src/components/AboutPage.astro',
        'src/pages/en/glossary/index.astro',
        'src/pages/en/graph.astro',
        'src/pages/en/library.astro',
        'src/pages/en/library/[slug].astro',
        'src/pages/glossary/index.astro',
        'src/pages/graph.astro',
        'src/pages/library.astro',
        'src/pages/library/[slug].astro',
      ].sort(),
    );
  });
});
