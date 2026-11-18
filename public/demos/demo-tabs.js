/* demo-tabs.js — chart tabs for the standalone demo boards.
 *
 * Twelve boards under `public/demos/` stack three to seven `.demo-card` sections,
 * each holding one chart. Read top to bottom, comparing two of them costs four
 * screens of scrolling. This module turns such a stack into one tab bar with one
 * card visible at a time.
 *
 * Progressive enhancement, in both directions:
 *   • no JS — nothing is ever hidden; the board keeps its long-scroll layout,
 *     which is why there is no `<noscript>` rule anywhere;
 *   • JS — a `.demo-tablist[role=tablist]` is inserted before the first card,
 *     cards become `role="tabpanel"` panels, and the ARIA tab pattern is wired
 *     (click, ArrowLeft/Right, ArrowUp/Down, Home/End, roving tabindex).
 *
 * Only cards carrying an `<h2>` become panels, and only as DIRECT children of
 * their parent — so a KPI tile (no heading) and a card nested in another card
 * (airflow's `.col`) never grow a tablist.
 *
 * The pattern is `src/components/SectionTabs.astro` + `src/lib/section-tabs-controller.ts`
 * ported to plain JS: the boards live in `public/`, which Astro copies verbatim,
 * so an Astro component cannot be mounted there. Class names are `.demo-tab*`
 * rather than `.section-*` so the two widgets never collide.
 *
 * Labels come from each card's own first `<h2>` — the boards already carry the
 * Russian search-facing title there, so a second hand-written source cannot
 * drift. They are shortened at the first `:`/` — `/`·`/`, ` when that leaves
 * ≥6 characters, otherwise capped at 30 with an ellipsis; the full heading stays
 * in the tab's `title` and `aria-label`.
 */

const CARD = '.demo-card';
// ponytail: labels are derived from the card heading, cut at the first
// delimiter, not authored per card — revisit if a shortened label reads wrong.
const MAX_LABEL = 30;
const MIN_SEGMENT = 6;
const CUTS = [' — ', ' · ', ': ', ', '];

function cap(text) {
  if (text.length <= MAX_LABEL) return text;
  const head = text.slice(0, MAX_LABEL);
  const space = head.lastIndexOf(' ');
  return (space > 0 ? head.slice(0, space) : head) + '…';
}

/** Tab label from a card heading. Pure, so the rule is testable. */
export function shortLabel(title) {
  const text = String(title || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const cuts = CUTS.map((cut) => text.indexOf(cut)).filter((at) => at >= MIN_SEGMENT);
  return cap(cuts.length ? text.slice(0, Math.min(...cuts)) : text);
}

/** What follows the first delimiter — volta has three `Market & Jobs — …` cards,
 *  whose heads are all identical, so the tail is the only part that differs. */
export function tailLabel(title) {
  const text = String(title || '').replace(/\s+/g, ' ').trim();
  for (const cut of CUTS) {
    const at = text.indexOf(cut);
    if (at >= MIN_SEGMENT) return cap(text.slice(at + cut.length));
  }
  return '';
}

/** One group per parent holding two or more panel cards, in document order.
 *  A card nested inside another card never starts its own group — its parent is
 *  a card, and that card belongs to the outer group. */
function collectGroups(doc) {
  const groups = [];
  const seen = new Map();
  for (const card of Array.from(doc.querySelectorAll(CARD))) {
    if (!card.querySelector('h2')) continue;
    const parent = card.parentElement;
    if (!parent || parent.closest(CARD)) continue;
    let group = seen.get(parent);
    if (!group) {
      group = { parent, cards: [] };
      seen.set(parent, group);
      groups.push(group);
    }
    group.cards.push(card);
  }
  return groups.filter((group) => group.cards.length >= 2);
}

function heading(card) {
  const h2 = card.querySelector('h2');
  return h2 ? h2.textContent : '';
}

/** Build the tabs for one group. Returns nothing; a group of one card is left
 *  alone — a tablist over a single panel is pure noise. */
function buildGroup(doc, panels, index) {
  const list = doc.createElement('div');
  list.className = 'demo-tablist';
  list.setAttribute('role', 'tablist');
  list.setAttribute('aria-label', 'Графики доски');

  const used = new Set();
  const tabs = panels.map((panel, i) => {
    const full = heading(panel);
    let label = shortLabel(full);
    if (used.has(label)) label = tailLabel(full);
    used.add(label);
    label = label || `График ${i + 1}`;
    panel.id = panel.id || `demo-panel-${index}-${i}`;
    panel.setAttribute('role', 'tabpanel');
    panel.hidden = i !== 0;

    const tab = doc.createElement('button');
    tab.type = 'button';
    tab.className = 'demo-tab';
    tab.id = `demo-tab-${index}-${i}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    tab.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    tab.setAttribute('aria-label', full);
    tab.title = full;
    tab.tabIndex = i === 0 ? 0 : -1;
    tab.textContent = label;
    panel.setAttribute('aria-labelledby', tab.id);
    list.appendChild(tab);
    return tab;
  });

  panels[0].parentNode.insertBefore(list, panels[0]);

  let active = 0;

  function activate(next, focus) {
    if (next < 0 || next >= panels.length) return;
    active = next;
    panels.forEach((panel, i) => {
      panel.hidden = i !== next;
    });
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', i === next ? 'true' : 'false');
      tab.tabIndex = i === next ? 0 : -1;
    });
    if (focus) tabs[next].focus();
    // causal, posthog and streamlit size their charts from `clientWidth` and
    // re-render on `resize`. A panel that was `hidden` measured 0, so nudge
    // them once the newly shown card has layout.
    const win = doc.defaultView;
    if (win) win.requestAnimationFrame(() => win.dispatchEvent(new win.Event('resize')));
  }

  list.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (!tab) return;
    event.preventDefault();
    activate(tabs.indexOf(tab), false);
  });

  list.addEventListener('keydown', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (!tab) return;
    let next = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (active + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (active - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    activate(next, true);
  });

  return { panels, tabs, activate };
}

/** Deep links: a hash naming a panel (or any element inside one) opens it.
 *  Boards link to their own headings (`#chart-title`), and such a heading can
 *  sit in the card that is hidden on load. */
function applyHash(doc, groups) {
  const raw = (doc.defaultView?.location.hash || '').replace(/^#/, '');
  if (!raw) return;
  let hash = raw;
  try {
    hash = decodeURIComponent(raw);
  } catch {
    /* a malformed escape stays as authored */
  }
  for (const group of groups) {
    const i = group.panels.findIndex(
      (panel) =>
        panel.id === hash ||
        Array.from(panel.querySelectorAll('[id]')).some((el) => el.id === hash),
    );
    if (i > -1) {
      group.activate(i, false);
      return;
    }
  }
}

/** Boot every tab group in `doc`. Exported so the test can drive a jsdom
 *  document directly; the page calls it through the bootstrap below. */
export function initDemoTabs(doc) {
  if (!doc || doc.querySelector('.demo-tablist')) return [];
  const groups = [];
  let index = 0;
  for (const group of collectGroups(doc)) {
    groups.push(buildGroup(doc, group.cards, index++));
  }
  if (!groups.length) return [];
  applyHash(doc, groups);
  const win = doc.defaultView;
  if (win) win.addEventListener('hashchange', () => applyHash(doc, groups));
  return groups;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initDemoTabs(document));
  } else {
    initDemoTabs(document);
  }
}
