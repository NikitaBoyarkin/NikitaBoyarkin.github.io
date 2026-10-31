import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  buildWikilinkRegistry,
  resolveWikilink,
  wikilinks,
  type WikilinkRegistry,
} from '../../src/lib/wikilink';
import type { GlossaryLinkerContext, GlossaryReplacement } from '../../src/lib/glossary-linker';

// The plugin shipped on 2026-10-31 with no test at all, and every `[[…]]` in the
// real content sits inside an inline-code span or a fenced block — where mdast
// yields `inlineCode`/`code` and the `text` visitor never runs. So the
// advertised guard ("a typo breaks the build") had zero production coverage, and
// the multi-link case (two links in one text node) was never exercised either.
// These tests run the plugin against a synthetic content tree instead of the
// vault, so they stay honest as content changes.

let root: string;

function seed(rel: string): void {
  const full = join(root, rel);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, '---\ntitle: fixture\n---\n\nbody\n');
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'wikilink-'));
  // `src/content/*` shape, because the plugin accepts a file only when its
  // resolved path contains `/src/content/`.
  const content = join(root, 'src', 'content');
  mkdirSync(content, { recursive: true });
  root = join(root, 'src');
  seed('content/posts/alpha.md');
  seed('content/posts-en/alpha.md');
  seed('content/posts/ru-only.md');
  seed('content/glossary/funnel.md');
  seed('content/projects/funnel.md');
  seed('content/volta-parts/kyc.md');
  seed('content/library/book.md');
  seed('content/posts/_draft.md');
});

afterAll(() => {
  if (root) rmSync(join(root, '..'), { recursive: true, force: true });
});

function registry(): WikilinkRegistry {
  return buildWikilinkRegistry(join(root, 'content'));
}

/** Minimal stand-in for Sätteri's visitor context. */
function context(fileURL: URL | undefined, parentType = 'paragraph') {
  const seen: GlossaryReplacement[][] = [];
  const ctx: GlossaryLinkerContext & { calls: GlossaryReplacement[][] } = {
    fileURL,
    calls: seen,
    parent: () => ({ type: parentType }),
    replaceNode: (_node, replacement) => {
      seen.push(replacement);
    },
  };
  return ctx;
}

const sourceAt = (rel: string) => pathToFileURL(join(root, rel));

function pluginFor(rel: string, reg: WikilinkRegistry = registry()) {
  const factory = wikilinks({ registry: reg });
  const plugin = factory({ fileURL: sourceAt(rel) });
  if (!plugin) throw new Error('plugin disabled for this file');
  return plugin;
}

function runText(rel: string, value: string, parentType = 'paragraph') {
  const plugin = pluginFor(rel);
  const ctx = context(sourceAt(rel), parentType);
  plugin.text?.({ type: 'text', value }, ctx);
  return ctx.calls;
}

describe('buildWikilinkRegistry', () => {
  it('indexes every collection dir and skips underscore-prefixed files', () => {
    const reg = registry();
    expect(reg.bySlug.has('_draft')).toBe(false);
    expect(reg.bySlug.get('party-does-not-exist')).toBeUndefined();
    expect(reg.bySlug.get('kyc')?.[0]?.path).toBe('/projects/volta/kyc/');
    expect(reg.bySlug.get('book')?.[0]?.path).toBe('/library/book/');
  });

  it('collects the same slug from both locales', () => {
    const paths = registry()
      .bySlug.get('alpha')
      ?.map((t) => t.path)
      .sort();
    expect(paths).toEqual(['/en/posts/alpha/', '/posts/alpha/']);
  });
});

describe('resolveWikilink', () => {
  it('reports an unknown slug instead of guessing', () => {
    const r = resolveWikilink(registry(), 'no-such-note');
    expect(r.target).toBeUndefined();
    expect(r.error).toContain('no note with this slug');
  });

  it('rejects a slug that names two different kinds', () => {
    const r = resolveWikilink(registry(), 'funnel');
    expect(r.target).toBeUndefined();
    expect(r.error).toContain('ambiguous');
    expect(r.error).toContain('glossary');
    expect(r.error).toContain('project');
  });

  it('prefers the EN twin for an EN source, and falls back to RU', () => {
    const en = resolveWikilink(registry(), 'alpha', { enSource: true });
    expect(en.target?.path).toBe('/en/posts/alpha/');

    const ru = resolveWikilink(registry(), 'alpha', { enSource: false });
    expect(ru.target?.path).toBe('/posts/alpha/');

    const fallback = resolveWikilink(registry(), 'ru-only', { enSource: true });
    expect(fallback.target?.path).toBe('/posts/ru-only/');
  });
});

describe('wikilinks() factory', () => {
  it('is disabled without a file URL, and outside src/content', () => {
    const factory = wikilinks({ registry: registry() });
    expect(factory({ fileURL: undefined })).toBe(false);
    expect(factory({ fileURL: pathToFileURL(join(root, '..', 'outside', 'alpha.md')) })).toBe(false);
  });

  it('is disabled for a non-markdown file', () => {
    const factory = wikilinks({ registry: registry() });
    expect(factory({ fileURL: sourceAt('content/posts/alpha.txt') })).toBe(false);
  });
});

describe('text handler', () => {
  it('rewrites a single link and keeps the surrounding prose', () => {
    const [nodes] = runText('content/posts/ru-only.md', 'см. [[alpha]] дальше');
    expect(nodes.map((n) => n.type)).toEqual(['text', 'link', 'text']);
    expect(nodes[1]).toMatchObject({ url: '/posts/alpha/', children: [{ value: 'alpha' }] });
    expect(nodes[0]).toMatchObject({ value: 'см. ' });
    expect(nodes[2]).toMatchObject({ value: ' дальше' });
  });

  it('uses the pipe label when one is given', () => {
    const [nodes] = runText('content/posts/ru-only.md', '[[alpha|первая заметка]]');
    const link = nodes.find((n) => n.type === 'link');
    expect(link).toMatchObject({ children: [{ value: 'первая заметка' }] });
  });

  it('resolves every link in one text node, not just the first', () => {
    const [nodes] = runText('content/posts/ru-only.md', 'A [[alpha]] B [[book]] C');
    expect(nodes.map((n) => n.type)).toEqual(['text', 'link', 'text', 'link', 'text']);
    expect(nodes.filter((n) => n.type === 'link').map((n) => n.url)).toEqual([
      '/posts/alpha/',
      '/library/book/',
    ]);
    // Nothing is left carrying literal brackets.
    for (const n of nodes) {
      if (n.type === 'text') expect(n.value).not.toContain('[[');
    }
  });

  it('does not lose text between two adjacent links', () => {
    const [nodes] = runText('content/posts/ru-only.md', '[[alpha]][[book]]');
    expect(nodes.map((n) => n.type)).toEqual(['link', 'link']);
    expect(nodes.map((n) => (n.type === 'link' ? n.url : null))).toEqual([
      '/posts/alpha/',
      '/library/book/',
    ]);
  });

  it('throws on a slug that does not exist — the build fails, it does not ship brackets', () => {
    expect(() => runText('content/posts/ru-only.md', 'см. [[typo-here]]')).toThrow(
      /no note with this slug/,
    );
  });

  it('throws on an ambiguous slug', () => {
    expect(() => runText('content/posts/ru-only.md', '[[funnel]]')).toThrow(/ambiguous/);
  });

  it('leaves headings, existing links and code alone', () => {
    for (const parentType of ['heading', 'link', 'code']) {
      expect(runText('content/posts/ru-only.md', '[[alpha]]', parentType)).toEqual([]);
    }
  });

  it('does nothing when the text has no wikilink', () => {
    expect(runText('content/posts/ru-only.md', 'обычный текст')).toEqual([]);
  });
});
