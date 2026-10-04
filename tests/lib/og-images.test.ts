import { describe, it, expect } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Binds the two claims `scripts/generate-og.mjs` makes about itself:
 *
 *   1. «Posts and projects share the og/ namespace; slugs are disjoint today» —
 *      the generator writes `public/images/og/<slug>.png` for both collections
 *      into one flat directory. A slug in both would silently overwrite one
 *      card with the other on every run, and nothing else would notice.
 *   2. A project that declares `ogImage` owns that file — the generator skips
 *      it. If the target does not exist, the card renders a broken preview and
 *      the OG crawler gets a 404 (this is exactly the EN `volta.md` bug: it
 *      pointed at a slug the generator never emits).
 *
 * Also binds the `ogImage` warning in `src/content.config.ts`: SVG must not go
 * there. OG crawlers do not render SVG, so the tag would be silently useless.
 */

const ROOT = path.resolve(import.meta.dir, '../..');
const CONTENT = path.join(ROOT, 'src/content');

function filesIn(dir: string): string[] {
  return fs
    .readdirSync(path.join(CONTENT, dir))
    .filter((f) => f.endsWith('.md'))
    .sort();
}

const slugOf = (file: string) => file.replace(/\.md$/, '');

/** Raw frontmatter block, or '' when the file has none. */
function frontmatter(file: string): string {
  const raw = fs.readFileSync(path.join(CONTENT, file), 'utf8');
  return raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
}

/** Unquoted value of a top-level scalar key, or null. */
function scalar(fm: string, key: string): string | null {
  const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (!m) return null;
  return m[1].trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1') || null;
}

/** Every `ogImage` in a collection, as `{ file, value }` — null when unset. */
function ogImages(dir: string) {
  return filesIn(dir).map((file) => ({ file, value: scalar(frontmatter(`${dir}/${file}`), 'ogImage') }));
}

const PROJECT_DIRS = ['projects', 'projects-en'];

describe('og image namespace', () => {
  it('keeps post and project slugs disjoint', () => {
    const posts = new Set(filesIn('posts').map(slugOf));
    const projects = filesIn('projects').map(slugOf);
    expect(posts.size).toBeGreaterThan(0);
    expect(projects.length).toBeGreaterThan(0);
    expect(projects.filter((slug) => posts.has(slug))).toEqual([]);
  });
});

describe('project ogImage frontmatter', () => {
  it('points every declared ogImage at a file that exists under public/', () => {
    const missing: string[] = [];
    let declared = 0;
    for (const dir of PROJECT_DIRS) {
      for (const { file, value } of ogImages(dir)) {
        if (!value) continue;
        declared++;
        const target = path.join(ROOT, 'public', value.replace(/^\//, ''));
        if (!fs.existsSync(target)) missing.push(`${dir}/${file} → ${value}`);
      }
    }
    // volta is the one project shipping a hand-made banner, so this is not zero.
    expect(declared).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it('never points ogImage at an SVG', () => {
    const svg: string[] = [];
    for (const dir of PROJECT_DIRS) {
      for (const { file, value } of ogImages(dir)) {
        if (value && value.toLowerCase().endsWith('.svg')) svg.push(`${dir}/${file} → ${value}`);
      }
    }
    expect(svg).toEqual([]);
  });

  it('declares ogImage on every project that the generator covers', () => {
    // The generator scans the RU collection only, so RU is the set that would
    // otherwise render a card with no `og:image` at all.
    const undeclared = ogImages('projects')
      .filter(({ value }) => !value)
      .map(({ file }) => file);
    expect(undeclared).toEqual([]);
  });
});
