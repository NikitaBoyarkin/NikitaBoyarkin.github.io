import { describe, it, expect } from 'bun:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// On 2026-11-01 `blog.css`, `prose.css`, `reader.css` and KaTeX's stylesheet left
// `Base.astro` (they rode along on all 223 pages: 1 200 lines of article CSS and
// 28 KB of KaTeX, of which 15 pages render blog cards, 100 render `.prose` and 30
// contain a formula). Each now lives in the templates that use it.
//
// The failure this guards is silent: a page that renders `.prose` without the
// sheet looks like unstyled body text, and NOTHING in a unit test or a type
// check notices — `astro check` is happy, the build is green, the page is
// broken. These assertions walk the built HTML and prove that whatever markup a
// page ships, the CSS it links can actually style it.

const ROOT = resolve(__dirname, '..', '..');
const DIST = resolve(ROOT, 'dist');

if (!existsSync(resolve(DIST, 'index.html'))) {
  throw new Error('dist/ missing — run `bun run build` first');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
}

const pages = walk(DIST);

function readText(file: string): string {
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

/** Concatenated CSS of every stylesheet a page links. */
function cssOf(html: string): string {
  return [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)]
    .map((m) => readText(resolve(DIST, `.${m[1]}`)))
    .join('\n')
    .replace(/\s+/g, '');
}

/** A page "needs" a sheet when its markup carries the selector's anchor. */
const CONTRACTS: { name: string; markup: RegExp; css: RegExp }[] = [
  { name: 'prose', markup: /class="prose/, css: /\.prose\{/ },
  { name: 'blog cards', markup: /class="blog-card/, css: /\.blog-card\{/ },
  { name: 'reader track', markup: /reader-track/, css: /\.reader-track/ },
  { name: 'KaTeX', markup: /class="katex/, css: /\.katex/ },
];

describe('every page links the stylesheet its markup needs', () => {
  for (const contract of CONTRACTS) {
    it(`${contract.name}`, () => {
      const offenders: string[] = [];
      let candidates = 0;
      for (const file of pages) {
        const html = readFileSync(file, 'utf8');
        if (!contract.markup.test(html)) continue;
        candidates += 1;
        if (!contract.css.test(cssOf(html))) offenders.push(file.replace(DIST, ''));
      }
      // A contract that matches nothing is a dead guard, not a passing one.
      expect(candidates, 'no page carries this markup — the guard is vacuous').toBeGreaterThan(0);
      expect(offenders).toEqual([]);
    });
  }

  it('keeps KaTeX off the pages that have no formula', () => {
    const home = readFileSync(resolve(DIST, 'index.html'), 'utf8');
    expect(home).not.toMatch(/\.katex/);
    expect(cssOf(home)).not.toMatch(/KaTeX_Main/);
  });
});
