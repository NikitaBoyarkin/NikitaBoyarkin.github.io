import { describe, it, expect } from 'bun:test';

import { figures, splitFigureNodes } from '../../src/lib/figures-mdast';

// The mdast half of the figure contract. `splitFigures` decides what a figure
// is; this module carries that decision into the markdown tree, and the two ways
// it can go wrong are structural: it can lose a run of prose, or it can wrap the
// wrong thing. Both are asserted here because the plugin is wired into
// `astro.config.mjs` for every markdown page on the site.

describe('splitFigureNodes', () => {
  it('returns null when the text has no figure', () => {
    expect(splitFigureNodes('')).toBeNull();
    expect(splitFigureNodes('23 проекта в 2025 году')).toBeNull();
    expect(splitFigureNodes('обычный текст')).toBeNull();
  });

  it('wraps a figure and leaves the prose around it as text nodes', () => {
    expect(splitFigureNodes('Итог: +5,72 п.п.')).toEqual([
      { type: 'text', value: 'Итог: ' },
      { type: 'html', value: '<span class="figure">+5,72</span>' },
      { type: 'text', value: ' п.п.' },
    ]);
  });

  it('keeps every character, in order', () => {
    const input = 'M3-удержание +9,09 п.п. (95% ДИ [+6,21; +11,96]), p = 0,29–0,70';
    const nodes = splitFigureNodes(input) ?? [];
    const flattened = nodes
      .map((n) =>
        n.type === 'html' ? n.value.replace(/^<span class="figure">|<\/span>$/g, '') : n.value,
      )
      .join('');
    expect(flattened).toBe(input);
  });

  it('emits nothing but a fixed span wrapper — no content reaches an attribute', () => {
    const nodes = splitFigureNodes('€208,5K за 12 мес') ?? [];
    for (const node of nodes) {
      if (node.type !== 'html') continue;
      expect(node.value).toMatch(/^<span class="figure">[^<>"']+<\/span>$/);
    }
  });
});

describe('figures() factory', () => {
  it('stands down for MDX, where a <span> is JSX rather than raw HTML', () => {
    expect(figures()({ sourceFormat: 'mdx' })).toBe(false);
  });

  it('runs for markdown and replaces only prose figures', () => {
    const plugin = figures()({ sourceFormat: 'markdown' }) as {
      text(node: { type: string; value: string }, ctx: unknown): void;
    };
    expect(plugin).not.toBe(false);

    const replacements: unknown[] = [];
    const node = { type: 'text', value: 'Итог +5,72 п.п.' };
    // A one-level chain: `parent(node)` is the context under test, `parent()` of
    // anything else is the root — which is what a real tree does.
    const ctx = (parentType: string | undefined) => ({
      parent: (n: unknown) => (n === node ? (parentType ? { type: parentType } : undefined) : undefined),
      replaceNode: (_node: unknown, replacement: unknown) => replacements.push(replacement),
    });

    plugin.text(node, ctx('paragraph'));
    expect(replacements).toHaveLength(1);

    for (const skip of ['link', 'linkReference', 'inlineCode', 'code', 'heading', 'table', 'tableCell']) {
      replacements.length = 0;
      plugin.text(node, ctx(skip));
      expect(replacements, `${skip} must not be recoloured`).toHaveLength(0);
    }

    // A figure inside `<strong>` inside a table cell: the walk must still find
    // the table and stand down. This is the shape mis-coloured on the Volta page.
    {
      replacements.length = 0;
      const strong = { type: 'strong' };
      const cell = { type: 'tableCell' };
      const chain = new Map<unknown, unknown>([
        [node, strong],
        [strong, cell],
      ]);
      plugin.text(node, {
        parent: (n: unknown) => chain.get(n),
        replaceNode: (_node: unknown, replacement: unknown) => replacements.push(replacement),
      });
      expect(replacements, 'a table cell must stay plain even under <strong>').toHaveLength(0);
    }

    // A longer chain of *non*-skipping parents must still reach the paragraph and
    // colour: the walk cannot stop after one hop (text → em → strong → paragraph).
    {
      replacements.length = 0;
      const em = { type: 'emphasis' };
      const strong = { type: 'strong' };
      const para = { type: 'paragraph' };
      const chain = new Map<unknown, unknown>([
        [node, em],
        [em, strong],
        [strong, para],
      ]);
      plugin.text(node, {
        parent: (n: unknown) => chain.get(n),
        replaceNode: (_node: unknown, replacement: unknown) => replacements.push(replacement),
      });
      expect(replacements, 'a figure in emphasis/strong prose must be coloured').toHaveLength(1);
    }

    replacements.length = 0;
    plugin.text({ type: 'text', value: 'без цифр' }, ctx('paragraph'));
    expect(replacements).toHaveLength(0);
  });
});
