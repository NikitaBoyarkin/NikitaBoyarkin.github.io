/** Sizes the project page's embedded board to the board's own height.
 *
 *  `components/ProjectDemo.astro` frames a same-origin board in an iframe. The
 *  frame used to carry one hand-picked `height="680"`, but the boards are not
 *  680px tall: measured at the embed width (1180px) they run from 322px
 *  (`python`) to 2052px (`trino-federation`), and `volta` — the flagship — is
 *  1218px. So every board taller than the frame grew its own nested scrollbar,
 *  and the reader met a dashboard cut in half by a scrollbar inside a page that
 *  already scrolls. Nested scrolling is the defect; this module removes it by
 *  making the frame exactly as tall as the document it holds.
 *
 *  Two entry points, one mechanism:
 *   · `iframe.project-demo-frame` — the project page's own lead board, fitted
 *     unconditionally;
 *   · `iframe[data-demo-fit]` — the explicit opt-in for a board embedded in a
 *     **case body** (`volta`'s dbt-charts board, `sql`'s Trino federation). The
 *     article rule still holds by default: an iframe written into an article
 *     owns its `height=`, because a chart illustration is sized for the column
 *     it sits in (`post` embeds stay at 280–540px). A case-body board is a
 *     dashboard with tabs and its own full-screen exit, so it asks for the fit
 *     in its own markup instead of the embedder guessing by slug.
 *
 *  Why the parent measures instead of the board reporting: the boards live in
 *  `public/`, copied verbatim, and only twelve of the twenty-five load
 *  `demo-tabs.js`. A `postMessage` protocol would need a script in every board
 *  and a listener in every embedder, and would still lose the eleven boards
 *  that ship no JS at all. Same-origin `contentDocument` is free here — the
 *  board is served from the same origin as the page that frames it — and one
 *  module covers every board, present and future.
 *
 *  What re-measures, and why each is needed:
 *   · `load` — the first measurement, and the only one a no-JS board ever needs;
 *   · a `ResizeObserver` on the board's `body` — a board whose tab bar swaps one
 *     chart for another is taller on one tab than the next, and `demo-tabs.js`
 *     only toggles `hidden`; without this the frame keeps tab 1's height over
 *     tab 3's chart. It is also what catches a frame that starts inside a hidden
 *     section panel (`section-tabs` reveals one panel; a board in another one
 *     measures 0 until its tab is opened);
 *   · `resize` inside the board — the boards are responsive, so a narrower
 *     frame is a taller board (at 390px `airflow` is 2743px, not 1465px);
 *   · `fonts.ready` — the first paint uses fallback metrics, and a webfont swap
 *     moves every baseline in the document.
 *
 *  No cap. A cap would put the inner scrollbar back for exactly the boards that
 *  have the most to show, and the frame is the page's lead: the case argues
 *  about this board, so the board is shown whole. `Открыть во весь экран` stays
 *  as the exit for a board that deserves its own viewport.
 *
 *  The authored `height` stays as the no-JS fallback and as the space reserved
 *  for a `loading="lazy"` frame before it is near the viewport. The fit runs on
 *  `load`, and because it only ever grows the frame downward, nothing above it
 *  moves — the shift it can cause is below the fold at both the mobile and the
 *  desktop Lighthouse viewport, which is what keeps `/projects/volta/`'s
 *  `cumulative-layout-shift` assertion green.
 */

export const FRAME_SELECTOR = 'iframe.project-demo-frame, iframe[data-demo-fit]';

/** Below this a board has not painted yet (a document that is still empty
 *  measures 0). Keeping the SSR height beats collapsing the frame to nothing. */
const MIN_HEIGHT = 160;

/** Documents already observed. A load that fires twice (or an `about:blank`
 *  document that is replaced by the real one) must not stack a second
 *  `ResizeObserver` on the same body. */
const observed = new WeakSet<Document>();

/** The height the board's own document needs, in CSS pixels. `scrollHeight`
 *  carries the padding and any panel that overflows the body box; the rect
 *  covers a board that reports 0 there. Deliberately not
 *  `documentElement.scrollHeight`: that value is floored at the frame's own
 *  viewport height, so measuring it would size the frame to itself. */
export function boardHeight(doc: Document): number {
  const body = doc.body;
  if (!body) return 0;
  return Math.max(body.scrollHeight, Math.ceil(body.getBoundingClientRect().height));
}

/** Border and padding the frame spends outside the board's own viewport. The
 *  site sets `box-sizing: border-box` globally, so the frame's 1px hairline is
 *  paid for out of the height written here: without this the board's last row
 *  sits 2px under the fold and the nested scrollbar this module exists to
 *  remove comes straight back. Read from the computed style rather than assumed,
 *  because the hairline belongs to the component's stylesheet. */
function frameChrome(frame: HTMLIFrameElement): number {
  const style = frame.ownerDocument?.defaultView?.getComputedStyle(frame);
  if (!style) return 0;
  const px = (value: string): number => Number.parseFloat(value) || 0;
  return (
    px(style.borderTopWidth) +
    px(style.borderBottomWidth) +
    px(style.paddingTop) +
    px(style.paddingBottom)
  );
}

/** Apply the board's height to the frame. Returns the applied height, or null
 *  when there is nothing to measure (not loaded, cross-origin, still empty). */
export function fitFrame(frame: HTMLIFrameElement): number | null {
  let doc: Document | null = null;
  try {
    doc = frame.contentDocument;
  } catch {
    // A cross-origin `demo:` is not framed at all (`ProjectDemo` renders the
    // link alone), so this is belt-and-braces for a future same-page embed.
    return null;
  }
  if (!doc || !doc.body) return null;

  const height = boardHeight(doc);
  if (height < MIN_HEIGHT) return null;

  // Both, on purpose: the inline style wins the cascade, and the attribute keeps
  // the DOM honest for anything reading the frame instead of the layout.
  const box = Math.round(height) + frameChrome(frame);
  if (frame.dataset.demoFitHeight === String(box)) return height;
  frame.dataset.demoFitHeight = String(box);
  frame.style.height = `${box}px`;
  frame.height = String(box);
  return height;
}

/** Measure on every change the board can make to its own height. Runs once per
 *  document; a re-`load` (a link inside a board, HMR) gets a fresh document. */
function observe(frame: HTMLIFrameElement): void {
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win || observed.has(doc)) return;
  observed.add(doc);

  // The body's box changes when a tab panel swaps, when a table re-renders and
  // when the frame's width changes — all of them mean a new height. The observer
  // is built in the parent realm and pointed at the board's own body: one
  // `ResizeObserver` can watch a node in any same-origin document.
  if (doc.body && typeof ResizeObserver === 'function') {
    new ResizeObserver(() => fitFrame(frame)).observe(doc.body);
  }

  // Height writes fire this event too; `fitFrame` compares before it writes, so
  // the loop stops after the first no-op instead of oscillating.
  win.addEventListener('resize', () => fitFrame(frame));

  // `fonts.ready` resolves immediately once the fonts are settled, so this is
  // one extra measure on a warm load, not a subscription.
  doc.fonts?.ready.then(() => fitFrame(frame)).catch(() => {});
}

/** Wire one frame. Idempotent: the module is bundled once per page, but the
 *  Bootstrap and a future second mount must not attach two `load` listeners.
 *  The marker is `data-demo-fit-bound`, NOT `data-demo-fit`: the latter is the
 *  authored opt-in this module reads, and a runtime marker spelled the same
 *  would put the opt-in on the project page's own frame after the first boot —
 *  harmless to the selector (it dedupes), but it makes the DOM claim an authored
 *  attribute nobody wrote. */
export function watchFrame(frame: HTMLIFrameElement): void {
  if (frame.dataset.demoFitBound === '1') return;
  frame.dataset.demoFitBound = '1';

  const apply = (): void => {
    // Observe first, then measure: a frame that is still inside a hidden panel
    // measures 0 and is skipped by `fitFrame`, but the body observer is what
    // catches it the moment the panel is revealed (a `ResizeObserver` reports
    // the 0 → real size transition). Without this, such a frame would keep the
    // SSR height forever.
    observe(frame);
    fitFrame(frame);
  };

  // Three cases, in the order they can happen: still loading (wait for `load`),
  // already loaded before this module executed (a warm cache, or the deferred
  // module landing after a small board), and the `about:blank` document a frame
  // starts with (measured, fails the MIN_HEIGHT guard, retried on `load`).
  if (frame.contentDocument?.readyState === 'complete') apply();
  frame.addEventListener('load', apply);
}

function boot(): void {
  for (const frame of Array.from(document.querySelectorAll<HTMLIFrameElement>(FRAME_SELECTOR))) {
    watchFrame(frame);
  }
}

// Guarded so the module can be imported by a test runner as well as by the
// browser: there is no `document` under `bun test`, and this file is imported
// for its helpers there, not for its bootstrap.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

// Marker, not an API: without a top-level import/export TypeScript treats this
// file as a global script and its helpers land on the global scope.
export {};
