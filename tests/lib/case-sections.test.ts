// The group table in `src/lib/case-sections.ts` decides both the tab bar and the
// panels the markdown plugin cuts. A heading missing from the table does not
// fail — it falls back to `more` — so nothing red would ever point at a typo'd
// or newly authored section. This is the mechanism that turns that silent drift
// into a red test.
//
// Runs over the sources, not dist/: the question is what the table covers, and a
// stale build would answer for yesterday's headings.

import { describe, it, expect } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { CASE_GROUP_ORDER, caseTabs, groupForHeading, isMappedHeading } from '../../src/lib/case-sections';

const ROOT = resolve(__dirname, '../..');

function h2s(dir: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const file of readdirSync(resolve(ROOT, dir)).filter((f) => f.endsWith('.md'))) {
    const body = readFileSync(resolve(ROOT, dir, file), 'utf8');
    // Frontmatter is fenced by `---`; headings never contain it, but the `faq:`
    // answers do contain `##` in prose, so parsing starts after the second fence.
    const afterFrontmatter = body.split(/^---$/m).slice(2).join('---');
    out.set(
      file,
      [...afterFrontmatter.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim()),
    );
  }
  return out;
}

describe.each([
  ['ru', 'src/content/projects'],
  ['en', 'src/content/projects-en'],
] as const)('%s project headings', (lang, dir) => {
  const files = h2s(dir);

  it('has headings to group', () => {
    expect(files.size).toBeGreaterThan(20);
  });

  it('spells out every shipped heading in the group table', () => {
    const unmapped: string[] = [];
    for (const [file, headings] of files) {
      for (const heading of headings) {
        if (!isMappedHeading(heading, lang)) unmapped.push(`${file}: ${heading}`);
      }
    }
    expect(unmapped).toEqual([]);
  });

  it('gives every case at least four tabs, in canonical order', () => {
    for (const [file, headings] of files) {
      const tabs = caseTabs(headings.map((text) => ({ text })), lang);
      expect(tabs.length).toBeGreaterThanOrEqual(4);
      const order = tabs.map((t) => CASE_GROUP_ORDER.indexOf(t.id.replace(/^case-/, '') as never));
      expect(order).toEqual([...order].sort((a, b) => a - b));
    }
  });

  it('opens on the context group', () => {
    for (const [file, headings] of files) {
      expect(`${file} ${caseTabs(headings.map((text) => ({ text })), lang)[0]?.id}`).toBe(
        `${file} case-context`,
      );
    }
  });

  it('files volta-only sections under `more`', () => {
    const volta = files.get('volta.md') ?? [];
    expect(volta.length).toBeGreaterThan(10);
    expect(caseTabs(volta.map((text) => ({ text })), lang).map((t) => t.id)).toContain('case-more');
  });
});

describe('groupForHeading', () => {
  it('normalises dashes and trailing punctuation', () => {
    expect(groupForHeading('Улики №1–4', 'ru')).toBe('actions');
    expect(groupForHeading('Улики №1-4', 'ru')).toBe('actions');
    expect(groupForHeading('  Задача:  ', 'ru')).toBe('context');
  });

  it('falls back to `more` instead of dropping an unknown heading', () => {
    expect(groupForHeading('Неизвестная секция', 'ru')).toBe('more');
    expect(isMappedHeading('Неизвестная секция', 'ru')).toBe(false);
  });
});
