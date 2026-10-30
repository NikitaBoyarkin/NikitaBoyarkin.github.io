import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSlideGroups, readerSlides } from '../../src/lib/reader-slides';

// Reader carousel — the article/project body split into `.reader-slide` sections.
//
// The defect this binds: the page templates wrap the rendered body in
// `.reader-track`, and the stylesheet turns that track into a horizontal snap
// row. That contract has three edges that fail silently:
//
//   - the split stops happening at top-level `##` (a heading level change in the
//     Markdown, or a plugin reordering), and the "carousel" silently degrades to
//     one very wide slide — the layout still scrolls, so nothing looks broken
//   - the intro block is dropped or merged into the first `##` slide, and the
//     opening paragraph of every article disappears from its own page
//   - the plugin starts firing outside the four paged collections, and the
//     glossary (whose h2s are navigational) loses its single-column layout
//
// The stylesheet guard is bound too: without `:has(> .reader-slide)` a body with
// no `##` is laid out as a flex row of squeezed paragraphs.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

type Node = { type: string; depth?: number };

const p = (): Node => ({ type: 'paragraph' });
const h2 = (): Node => ({ type: 'heading', depth: 2 });
const h3 = (): Node => ({ type: 'heading', depth: 3 });

/** Run the plugin's `before` hook over `children` and record the tag order. */
function emit(children: Node[]): string[] {
  const seq: Array<Node | string> = [...children];
  const insert = (target: Node, value: string, after: boolean) => {
    const at = seq.indexOf(target);
    seq.splice(after ? at + 1 : at, 0, value);
  };
  const plugin = readerSlides()({
    fileURL: new URL('file:///repo/src/content/posts/example.md'),
  });
  if (!plugin) throw new Error('plugin did not activate for the posts collection');
  plugin.before(
    { type: 'root', children },
    {
      insertBefore: (node: Node, newNode: { value: string }) => insert(node, newNode.value, false),
      insertAfter: (node: Node, newNode: { value: string }) => insert(node, newNode.value, true),
    } as never,
  );
  return seq.map((item) => (typeof item === 'string' ? item : item.type));
}

describe('buildSlideGroups', () => {
  it('emits nothing when the body has no top-level h2', () => {
    expect(buildSlideGroups([p(), h3(), p()])).toEqual([]);
  });

  it('makes the pre-heading block slide 0 and numbers h2 runs from 1', () => {
    const children = [p(), h2(), p(), p(), h2(), p()];
    const groups = buildSlideGroups(children);
    expect(groups.map((g) => g.slide)).toEqual([0, 1, 2]);
    expect(groups[0].anchor).toBe(children[0]);
    expect(groups[0].members).toHaveLength(0);
    expect(groups[1].anchor).toBe(children[1]);
    expect(groups[1].members).toEqual(children.slice(2, 4));
    expect(groups[2].members).toEqual([children[5]]);
  });

  it('starts at slide 1 when the body opens with a heading', () => {
    const groups = buildSlideGroups([h2(), p(), h2()]);
    expect(groups.map((g) => g.slide)).toEqual([1, 2]);
    // …and an empty trailing slide is still emitted: the h2 is a slide of one.
    expect(groups[1].members).toHaveLength(0);
  });

  it('treats only depth 2 as a split point', () => {
    expect(buildSlideGroups([p(), h3(), p()])).toEqual([]);
    expect(buildSlideGroups([h2(), h3(), p()])[0].members).toHaveLength(2);
  });
});

describe('readerSlides factory', () => {
  const activate = (path: string) =>
    readerSlides()({ fileURL: new URL(`file:///repo/${path}`) });

  it('activates on the four paged collections only', () => {
    for (const path of [
      'src/content/posts/a.md',
      'src/content/posts-en/a.md',
      'src/content/projects/b.md',
      'src/content/projects-en/b.md',
    ]) {
      expect(activate(path)).toBeTruthy();
    }
    for (const path of ['src/content/glossary/c.md', 'src/content/volta-parts/d.md', 'src/pages/about.mdx']) {
      expect(activate(path)).toBeFalsy();
    }
    expect(readerSlides()({ fileURL: undefined })).toBeFalsy();
  });
});

describe('emitted markup', () => {
  it('closes a slide before opening the next, with no node moved', () => {
    const children = [p(), h2(), p(), h2(), p()];
    const open = (n: number) => `<section class="reader-slide" data-slide="${n}">`;
    expect(emit(children)).toEqual([
      open(0),
      'paragraph',
      '</section>',
      open(1),
      'heading',
      'paragraph',
      '</section>',
      open(2),
      'heading',
      'paragraph',
      '</section>',
    ]);
  });
});

describe('wiring', () => {
  const CONFIG = read('astro.config.mjs');
  const BASE = read('src/layouts/Base.astro');
  const CSS = read('src/styles/reader.css');
  const TEMPLATES = [
    'src/layouts/Post.astro',
    'src/pages/projects/[slug].astro',
    'src/pages/en/projects/[slug].astro',
  ];

  it('registers the plugin after the existing mdast plugins', () => {
    expect(CONFIG).toMatch(/mdastPlugins:\s*\[[^\]]*glossaryLinker\(\),\s*wikilinks\(\),\s*readerSlides\(\)/);
  });

  it('imports the reader sheet after the prose layer', () => {
    expect(BASE.indexOf("styles/prose.css")).toBeGreaterThan(-1);
    expect(BASE.indexOf("styles/reader.css")).toBeGreaterThan(BASE.indexOf("styles/prose.css"));
  });

  it('guards the track so a body without slides stays a column', () => {
    expect(CSS).toMatch(/\.reader-track:has\(> \.reader-slide\)/);
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('wires a track and its nav into all three body templates', () => {
    for (const rel of TEMPLATES) {
      const file = read(rel);
      expect(file).toMatch(/class="reader-track" data-carousel-track="reader"/);
      expect(file).toMatch(/<CarouselNav\s+track="reader"/);
      expect(file).toMatch(/import CarouselNav from '.*components\/CarouselNav\.astro';/);
    }
  });

  it('keeps the project h1 styled now that it sits inside slide 0', () => {
    // The chain must name the track: templates nest `.prose > .reader-track >
    // .reader-slide`, so `.prose > .reader-slide` selects nothing and the h1
    // silently falls back to the UA 2em / inherited line-height.
    const PROSE = read('src/styles/prose.css');
    expect(PROSE).toMatch(
      /\.prose > \.reader-track > \.reader-slide\[data-slide='0'\] > h1:first-child/,
    );
  });
});
