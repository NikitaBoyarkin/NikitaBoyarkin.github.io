// Table of contents against the REAL built HTML (dist/).
//
// `InnerTOC`'s inline script scans a page's headings once and fills both the
// fixed rail (#inner-toc-list) and the in-flow block (#inline-toc-list, see
// components/InlineTOC.astro). The rail is `display: none` below 1100px, so a
// page that renders the inline shell but never fills it has NO table of
// contents on a laptop or a phone — the exact failure this suite exists to
// catch, and one no server-rendered assertion can see.
//
// Follows the pattern of tests/built/theme.test.ts: the emitted script is
// extracted from dist/ and evaluated in jsdom, so what ships is what is tested.
//
// Requires `bun run build` first (reads dist/*.html).

import { describe, it, expect } from 'bun:test';
import { JSDOM } from 'jsdom';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');

// One page per template that renders a TOC: posts and projects (RU), projects
// (EN), and the Volta part pages, which gained the rail in the same change.
const PAGES = [
  { file: 'posts/bayesian-ab-testing/index.html', container: '#post-content' },
  { file: 'projects/site/index.html', container: '#project-content' },
  { file: 'en/projects/site/index.html', container: '#project-content' },
  { file: 'projects/volta/ab/index.html', container: '#project-content' },
  { file: 'en/projects/volta/ab/index.html', container: '#project-content' },
];

// The minifier strips whitespace but keeps the `define:vars` wrapper, so the
// script runs from `(function(){const selector` to its closing `})();`.
function extractTocScript(html: string): string {
  const start = html.indexOf('(function(){const selector');
  if (start === -1) return '';
  const end = html.indexOf('})();', start);
  return end === -1 ? '' : html.slice(start, end + 5);
}

function tocOf(file: string): Document {
  const html = readFileSync(resolve(DIST, file), 'utf8');
  const dom = new JSDOM(html, { url: 'https://example.com/', runScripts: 'outside-only' });
  const { window } = dom;

  // jsdom ships no matchMedia; the script reads it for reduced-motion and for
  // the ≤1100px collapse. Stub it rather than let init throw.
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  const script = extractTocScript(html);
  if (script) window.eval(script);

  // The document was parsed before `eval`, so its own DOMContentLoaded has
  // already fired — dispatch one for the listener the script just registered.
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

  return window.document;
}

describe('TOC (built HTML, real inline script)', () => {
  for (const { file, container } of PAGES) {
    it(`${file} fills the rail and the inline list from one heading scan`, () => {
      if (!existsSync(resolve(DIST, file))) return; // needs `bun run build`
      const doc = tocOf(file);

      const headings = [...doc.querySelectorAll(`${container} h2, ${container} h3`)];
      const rail = [...doc.querySelectorAll('#inner-toc-list li a')];
      const inline = [...doc.querySelectorAll('#inline-toc-list li a')];

      expect(headings.length).toBeGreaterThan(0);
      expect(rail.length).toBe(headings.length);
      expect(inline.length).toBe(headings.length);

      // Both lists must point at the same anchors, or the two renderings of the
      // same scan have drifted.
      expect(inline.map((a) => a.getAttribute('href'))).toEqual(rail.map((a) => a.getAttribute('href')));

      // And every anchor must land on a heading the scan gave an id.
      for (const a of rail) {
        expect(doc.getElementById(a.getAttribute('href')!.slice(1))).not.toBeNull();
      }
    });
  }
});
