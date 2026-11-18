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
// A hub project page ships the rail only: its case body is a tabbed dashboard,
// so the in-flow inline list (`InlineTOC`) was dropped there — the section tabs
// cover the same jump targets. The Volta part template has no nested tabs, so it
// keeps both.
const PAGES = [
  { file: 'posts/bayesian-ab-testing/index.html', container: '#post-content', inline: true },
  { file: 'projects/site/index.html', container: '#project-content', inline: false },
  { file: 'en/projects/site/index.html', container: '#project-content', inline: false },
  { file: 'projects/volta/ab/index.html', container: '#project-content', inline: true },
  { file: 'en/projects/volta/ab/index.html', container: '#project-content', inline: true },
];

// The minifier strips whitespace but keeps the `define:vars` wrapper, so the
// script runs from `(function(){const selector` to its closing `})();`.
function extractTocScript(html: string): string {
  const start = html.indexOf('(function(){const selector');
  if (start === -1) return '';
  const end = html.indexOf('})();', start);
  return end === -1 ? '' : html.slice(start, end + 5);
}

function tocOf(file: string, opts: { tocHidden?: boolean } = {}): Document {
  const html = readFileSync(resolve(DIST, file), 'utf8');
  const dom = new JSDOM(html, { url: 'https://example.com/', runScripts: 'outside-only' });
  const { window } = dom;

  // A fresh JSDOM per call shares no storage, so the remembered choice has to
  // be planted before the page's own script runs — that is the order a real
  // second visit has.
  if (opts.tocHidden) window.localStorage.setItem('toc-hidden', '1');

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
  for (const { file, container, inline: hasInline } of PAGES) {
    it(`${file} fills the rail${hasInline ? ' and the inline list' : ''} from one heading scan`, () => {
      if (!existsSync(resolve(DIST, file))) return; // needs `bun run build`
      const doc = tocOf(file);

      const headings = [...doc.querySelectorAll(`${container} h2, ${container} h3`)];
      const rail = [...doc.querySelectorAll('#inner-toc-list li a')];
      const inline = [...doc.querySelectorAll('#inline-toc-list li a')];

      expect(headings.length).toBeGreaterThan(0);
      expect(rail.length).toBe(headings.length);

      if (hasInline) {
        expect(inline.length).toBe(headings.length);

        // Both lists must point at the same anchors, or the two renderings of the
        // same scan have drifted.
        expect(inline.map((a) => a.getAttribute('href'))).toEqual(rail.map((a) => a.getAttribute('href')));
      } else {
        expect(doc.getElementById('inline-toc-list')).toBeNull();
      }

      // And every anchor must land on a heading the scan gave an id.
      for (const a of rail) {
        expect(doc.getElementById(a.getAttribute('href')!.slice(1))).not.toBeNull();
      }
    });
  }
});

describe('the rail starts where its template says', () => {
  it('is collapsed on first visit to a project page, expanded on a post', () => {
    if (!existsSync(resolve(DIST, 'projects/site/index.html'))) return; // needs `bun run build`
    // Project pages pass `defaultHidden`: their case body is tabbed, so an open
    // rail competes with the section tabs for the same right edge.
    expect(tocOf('projects/site/index.html').documentElement.classList.contains('toc-collapsed')).toBe(true);
    expect(tocOf('posts/bayesian-ab-testing/index.html').documentElement.classList.contains('toc-collapsed')).toBe(false);
  });

  it('remembers an explicit reveal on a page that starts collapsed', () => {
    if (!existsSync(resolve(DIST, 'projects/site/index.html'))) return;
    const doc = tocOf('projects/site/index.html');
    doc.getElementById('toc-restore')!.click();
    // `'0'`, not a cleared key: with `defaultHidden`, "no key" means collapsed
    // again, so the reveal would not survive the next navigation.
    expect(doc.defaultView!.localStorage.getItem('toc-hidden')).toBe('0');
  });
});

// «Скрыть» releases the fixed rail's reserved strip — `html.toc-collapsed` is
// what both the rail's display and the body padding key on, so the class is the
// observable behaviour, not a proxy for it.
describe('the rail can be dismissed and restored (built inline script)', () => {
  const file = 'posts/bayesian-ab-testing/index.html';

  it('hide collapses, restore brings the rail back', () => {
    if (!existsSync(resolve(DIST, file))) return; // needs `bun run build`
    const doc = tocOf(file);
    const root = doc.documentElement;
    const hide = doc.getElementById('toc-hide')!;
    const restore = doc.getElementById('toc-restore')!;

    expect(root.classList.contains('toc-collapsed')).toBe(false);
    hide.click();
    expect(root.classList.contains('toc-collapsed')).toBe(true);
    expect(hide.getAttribute('aria-expanded')).toBe('false');
    restore.click();
    expect(root.classList.contains('toc-collapsed')).toBe(false);
    expect(hide.getAttribute('aria-expanded')).toBe('true');
  });

  it('a remembered choice is applied on load', () => {
    if (!existsSync(resolve(DIST, file))) return;
    const doc = tocOf(file, { tocHidden: true });
    expect(doc.documentElement.classList.contains('toc-collapsed')).toBe(true);
    expect(doc.getElementById('toc-hide')!.getAttribute('aria-expanded')).toBe('false');
  });
});
