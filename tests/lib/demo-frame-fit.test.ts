// The project page's embedded boards must be visible whole — no nested
// scrollbar inside an already scrolling page.
//
// The defect this binds: `components/ProjectDemo.astro` framed every board at
// one hand-picked `height="680"`. Measured at the embed width the boards run
// 322px (`python`) to 2052px (`trino-federation`), and `volta` — the flagship,
// and the only project page Lighthouse audits — is 1218px, so its own scrollbar
// sat inside the page's. `lib/demo-frame-fit` sizes the frame to the board's
// document instead; this file pins the four things that can silently undo it:
//
//   1. the measurement reading the wrong box — `documentElement.scrollHeight` is
//      floored at the frame's own viewport, so a frame sized from it would size
//      itself and never settle (the failure looks like a frame that grows a few
//      pixels on every repaint);
//   2. the frame's own hairline being left out of the height — the site is
//      `box-sizing: border-box` throughout, so a 1px top and bottom border eat
//      2px of the board and the scrollbar comes back by exactly that much;
//   3. the component losing the module — the whole mechanism is one import, and
//      an unused import in a template is invisible in a diff and in a build log;
//   4. a case-body board forgetting the `data-demo-fit` opt-in it needs to be
//      fitted at all — the attribute lives in four content files, not in code.
//
// Not bound here: the rendered result (is the board actually visible whole in a
// browser). That needs layout, so it was verified in Chromium — the frame's
// `scrollHeight` equals its `clientHeight` on `/projects/volta/` at 1440px and
// at 390px, on every board tab, and after a theme switch, and on the case-body
// boards in `/projects/sql/` and `/projects/volta/` once their section tab is
// opened (they start inside a hidden panel and are fitted the moment it shows).

import { describe, it, expect } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { FRAME_SELECTOR, boardHeight, fitFrame, watchFrame } from '../../src/lib/demo-frame-fit';

const ROOT = resolve(__dirname, '..', '..');

function caseOf(markup: string) {
  const dom = new JSDOM(`<!doctype html><body>${markup}</body>`, { pretendToBeVisual: true });
  return dom.window.document;
}

/** jsdom has no layout engine, so the two boxes a real board reports are
 *  declared by hand: the body's own height and whatever the element-level
 *  scroll area says. */
function withBoard(doc: Document, bodyHeight: number): Document {
  const body = doc.body;
  Object.defineProperty(body, 'scrollHeight', { value: bodyHeight, configurable: true });
  Object.defineProperty(body, 'getBoundingClientRect', {
    value: () => ({ height: bodyHeight, bottom: bodyHeight }),
    configurable: true,
  });
  return doc;
}

describe('boardHeight', () => {
  it('measures the board body, never the frame viewport', () => {
    const doc = withBoard(caseOf('<p>board</p>'), 1218);
    // `documentElement.scrollHeight` is 5000 here on purpose: it is floored at
    // the frame's own height, so measuring it would feed the frame its own size.
    Object.defineProperty(doc.documentElement, 'scrollHeight', { value: 5000 });
    expect(boardHeight(doc)).toBe(1218);
  });

  it('takes the larger of the scroll area and the body box', () => {
    const doc = withBoard(caseOf('<p>board</p>'), 900);
    Object.defineProperty(doc.body, 'scrollHeight', { value: 980, configurable: true });
    expect(boardHeight(doc)).toBe(980);
  });

  it('is 0 for a document that has not painted a body yet', () => {
    const dom = new JSDOM('<!doctype html>', { pretendToBeVisual: true });
    dom.window.document.documentElement.replaceChildren();
    expect(boardHeight(dom.window.document)).toBe(0);
  });
});

describe('fitFrame', () => {
  function framed(scrollHeight: number) {
    const doc = caseOf('<iframe class="project-demo-frame" height="680"></iframe>');
    const frame = doc.querySelector('iframe') as HTMLIFrameElement;
    const inner = frame.contentDocument!;
    Object.defineProperty(inner.body, 'scrollHeight', { value: scrollHeight, configurable: true });
    Object.defineProperty(inner.body, 'getBoundingClientRect', {
      value: () => ({ height: scrollHeight, bottom: scrollHeight }),
      configurable: true,
    });
    return { frame, inner };
  }

  it('grows the frame to the board, hairline included', () => {
    const { frame } = framed(1218);
    expect(fitFrame(frame)).toBe(1218);

    // Border-box: the style height is the board plus the frame's own border, so
    // the board's own viewport — not the element box — is 1218px tall.
    const style = parseFloat(frame.style.height);
    const border =
      parseFloat(frame.ownerDocument.defaultView!.getComputedStyle(frame).borderTopWidth || '0') +
      parseFloat(frame.ownerDocument.defaultView!.getComputedStyle(frame).borderBottomWidth || '0');
    expect(style).toBe(1218 + border);
    // The attribute follows, so the DOM reports the applied height too.
    expect(Number(frame.getAttribute('height'))).toBe(style);
  });

  it('shrinks a board shorter than the old 680px fallback', () => {
    const { frame } = framed(322);
    fitFrame(frame);
    expect(parseFloat(frame.style.height)).toBeLessThan(680);
  });

  it('is idempotent — a re-measure of an unchanged board writes nothing new', () => {
    const { frame } = framed(970);
    fitFrame(frame);
    const once = frame.style.height;
    fitFrame(frame);
    expect(frame.style.height).toBe(once);
    expect(frame.dataset.demoFitHeight).toBe(String(parseFloat(once)));
  });

  it('leaves the SSR fallback alone while the board has not painted', () => {
    const { frame } = framed(0);
    expect(fitFrame(frame)).toBeNull();
    expect(frame.style.height).toBe('');
    expect(frame.getAttribute('height')).toBe('680');
  });

  it('returns null instead of throwing when the frame has no document', () => {
    const doc = caseOf('');
    const frame = doc.createElement('iframe');
    expect(frame.contentDocument).toBeNull();
    expect(fitFrame(frame)).toBeNull();
  });

  it('never stamps the authored opt-in onto a frame it only fitted', () => {
    // `dataset.demoFit` would spell `data-demo-fit` — the attribute content
    // authors. Writing it here would make the DOM claim an opt-in nobody wrote,
    // so the runtime marker is `data-demo-fit-bound`.
    const { frame } = framed(700);
    watchFrame(frame);
    expect(frame.hasAttribute('data-demo-fit')).toBe(false);
    expect(frame.dataset.demoFitBound).toBe('1');
  });
});

describe('component wiring', () => {
  const component = readFileSync(resolve(ROOT, 'src/components/ProjectDemo.astro'), 'utf8');

  it('loads the fitter from the component that renders the frame', () => {
    expect(component).toContain("import '../lib/demo-frame-fit'");
  });

  it('keeps an SSR height on the frame for a reader without JS', () => {
    expect(component).toMatch(/class="project-demo-frame"[\s\S]*?height="\d+"/);
  });
});

// A board embedded in a *case body* is a dashboard too — tabs, its own
// full-screen exit — so it asks for the fit from its own markup rather than the
// embedder guessing by slug. The article rule stays the default for everything
// else: an iframe written into a post is a chart sized for the prose column.
describe('case-body boards opt in explicitly', () => {
  const CASES = [
    'src/content/projects/volta.md',
    'src/content/projects/sql.md',
    'src/content/projects-en/volta.md',
    'src/content/projects-en/sql.md',
  ];

  it('matches both the project lead frame and the opt-in frames', () => {
    expect(FRAME_SELECTOR).toContain('iframe.project-demo-frame');
    expect(FRAME_SELECTOR).toContain('iframe[data-demo-fit]');
  });

  it.each(CASES)('%s carries data-demo-fit and a fallback height', (file) => {
    const body = readFileSync(resolve(ROOT, file), 'utf8');
    const frames = [...body.matchAll(/<iframe\b[^>]*>/g)].map((m) => m[0]);
    const opted = frames.filter((tag) => /(?:^|\s)data-demo-fit(?:\s|=|>)/.test(tag));
    expect(opted.length).toBe(1);
    // The attribute must not replace the server-rendered height: a reader
    // without JS, and the space reserved before a lazy frame loads, both need it.
    expect(opted[0]).toMatch(/\sheight="\d+"/);
  });

  it('leaves an article iframe at the height the article authored', () => {
    const posts = resolve(ROOT, 'src/content/posts');
    const offenders = readdirSync(posts)
      .filter((file) => file.endsWith('.md'))
      .filter((file) => readFileSync(resolve(posts, file), 'utf8').includes('data-demo-fit'));
    expect(offenders).toEqual([]);
  });
});
