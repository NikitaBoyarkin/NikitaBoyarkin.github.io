/** Client controller for the section dashboard in `components/SectionTabs.astro`.
 *
 *  The component is server-rendered markup first: the first tab is selected and
 *  focusable in the HTML, no tab is hidden from a reader without JS (a
 *  `<noscript>` rule reveals every panel and hides the tablist). This module is
 *  the progressive enhancement on top — it reveals one panel, wires the ARIA tab
 *  pattern (click + arrows/Home/End), maps any anchor inside a panel to that
 *  panel (so #heading deep-links open the right tab), reveals `.reveal` nodes in
 *  the freshly shown panel, and — when `data-rail-id` points at a fixed
 *  table-of-contents rail — shows that rail only while a panel marked
 *  `data-owns-rail` is active (otherwise a hidden panel's TOC would sit over the
 *  section that replaced it).
 *
 *  Everything it needs comes from the markup, so it takes no props and no
 *  per-instance parameters. It is a bundled module (imported by the component's
 *  `<script>`) rather than an inline `<script is:inline>`: Astro emits one module
 *  per imported URL, so this file executes exactly once per page even where the
 *  component mounts several times (three dashboards on `/talks/`).
 */

const ROOT_SELECTOR = '[data-section-tabs]';

/** One controller per root, because a page may nest a second dashboard inside a
 *  panel of the first (`/talks/` does: tracks inside the tracks panel).
 *  `closest` keeps each root to its own tabs and its own panels — a nested panel
 *  belongs to the inner root, not to the outer one. */
function owned<T extends Element>(root: HTMLElement, selector: string): T[] {
  return Array.prototype.filter.call(
    root.querySelectorAll(selector),
    (el: Element) => el.closest(ROOT_SELECTOR) === root,
  ) as T[];
}

function init(root: HTMLElement): void {
  const tabs = owned<HTMLElement>(root, '[role="tab"]');
  const panels = owned<HTMLElement>(root, '[data-panel]');
  if (!panels.length) return;

  // Phone-only replacement for the nested (`--sm`) chip strip: one native
  // select. Null on every desktop dashboard and on page-level tabs, so the code
  // below is a no-op there.
  const select = owned<HTMLSelectElement>(root, '[data-section-select] select')[0] ?? null;

  const railId = root.getAttribute('data-rail-id') || '';
  const rail = railId ? document.getElementById(railId) : null;
  const first = panels[0].getAttribute('data-panel') ?? '';

  // Anchor id -> panel id. Derived from the DOM, so a new heading inside a panel
  // (or a new panel) needs no change here.
  const anchors: Record<string, string> = {};
  for (const panel of panels) {
    const id = panel.getAttribute('data-panel');
    if (!id) continue;
    anchors[id] = id;
    for (const el of Array.from(panel.querySelectorAll<HTMLElement>('[id],[data-panel]'))) {
      if (el.id) anchors[el.id] = id;
      // A nested dashboard's tab ids (`#avito`) exist only as its panels'
      // `data-panel`, so without this line a shared /talks/#avito falls back to
      // the first page tab instead of opening the tracks panel.
      const nested = el.getAttribute('data-panel');
      if (nested) anchors[nested] = id;
    }
  }

  function fromHash(): string {
    const hash = (location.hash || '').replace(/^#/, '');
    return anchors[hash] || first;
  }

  function activate(id: string | null | undefined, focus: boolean): void {
    if (!id) id = first;
    // Keep the phone select in step with whatever the tabs are showing: a deep
    // link (#track-avito, #theme-ai), a page-level tab switch that revealed this
    // panel, or a tab click all land here.
    if (select && select.value !== id) select.value = id;
    let ownsRail = false;
    for (const panel of panels) {
      const on = panel.getAttribute('data-panel') === id;
      panel.hidden = !on;
      if (!on) continue;
      if (panel.hasAttribute('data-owns-rail')) ownsRail = true;
      // `.reveal` nodes start at opacity 0; an IntersectionObserver cannot see a
      // panel that was display:none at parse time, so reveal them here or a
      // switched-to panel (charts, graph) stays blank.
      for (const el of Array.from(panel.querySelectorAll<HTMLElement>('.reveal'))) {
        el.classList.add('visible');
      }
      // A nested dashboard in this panel centred its selected tab while the
      // panel had no layout, so the centring was a no-op. Redo it now that the
      // strip has a width.
      for (const nested of Array.from(panel.querySelectorAll<HTMLElement>(ROOT_SELECTOR))) {
        const selTab = nested.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
        if (selTab) revealTab(selTab);
      }
    }
    for (const tab of tabs) {
      const on = tab.dataset.tab === id;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      if (on) revealTab(tab);
      if (on && focus) tab.focus();
    }
    // The fixed TOC rail belongs to the case-study panel: hide it with the panel
    // it describes, or its links scroll to headings nobody can see.
    if (rail) rail.hidden = !ownsRail;
    root.setAttribute('data-active', id);
  }

  // On a phone the tablist is one horizontal strip, so the selected tab can sit
  // outside the scrollport. Centre it there by moving the strip's own
  // scrollLeft: `scrollIntoView` would also move the document, undoing the jump
  // the reader just made.
  function revealTab(tab: HTMLElement): void {
    const list = tab.parentElement;
    if (!list || list.scrollWidth <= list.clientWidth) return;
    const listBox = list.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    const left =
      list.scrollLeft + (tabBox.left - listBox.left) - (list.clientWidth - tabBox.width) / 2;
    list.scrollLeft = Math.max(0, Math.min(left, list.scrollWidth - list.clientWidth));
  }

  function scrollToAnchor(id: string | null): void {
    if (!id) return;
    // A hash may name a heading inside a panel (`#theme-ai`, `#t288`) or a tab,
    // which has no element of its own — its node is `panel-<id>`. Without the
    // fallback `#tracks` opened the right panel and left the page on top.
    const el = document.getElementById(id) || document.getElementById('panel-' + id);
    if (el) el.scrollIntoView({ block: 'start' });
  }

  function setAnchor(anchor: string | null | undefined): void {
    if (anchor && location.hash !== '#' + anchor) {
      history.replaceState(null, '', '#' + anchor);
    }
  }

  const initial = (location.hash || '').replace(/^#/, '');
  activate(fromHash(), false);
  if (initial) {
    requestAnimationFrame(() => {
      scrollToAnchor(initial);
    });
  }

  root.addEventListener('click', (event) => {
    const tab = (event.target as Element | null)?.closest<HTMLElement>('[role="tab"]');
    if (!tab || !root.contains(tab) || tabs.indexOf(tab) < 0) return;
    event.preventDefault();
    activate(tab.dataset.tab, false);
    setAnchor(tab.dataset.anchor);
  });

  // Phone select. `change` fires once per pick (not per option as it does on
  // some Android builds), and the same `activate` path runs, so anchors, rails
  // and `.reveal` reveal behave exactly as with a chip click. Bound once per
  // root: the controller boots once, so the guard is on the element, not on the
  // root — it survives a re-boot on the same DOM.
  if (select && !select.dataset.bound) {
    select.dataset.bound = '1';
    select.addEventListener('change', () => {
      const id = select.value;
      const tab = tabs.find((t) => t.dataset.tab === id) ?? null;
      activate(id, false);
      if (tab) setAnchor(tab.dataset.anchor);
    });
  }

  root.addEventListener('keydown', (event) => {
    const tab = (event.target as Element | null)?.closest<HTMLElement>('[role="tab"]');
    if (!tab) return;
    const i = tabs.indexOf(tab);
    if (i < 0) return;
    let n = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') n = (i + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') n = (i - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') n = 0;
    else if (event.key === 'End') n = tabs.length - 1;
    else return;
    event.preventDefault();
    const next = tabs[n];
    activate(next.dataset.tab, true);
    setAnchor(next.dataset.anchor);
  });

  window.addEventListener('hashchange', () => {
    const hash = (location.hash || '').replace(/^#/, '');
    activate(fromHash(), false);
    scrollToAnchor(hash);
  });
}

/** Boot every root once. The controller is emitted once per page, but the
 *  `data-section-tabs-ready` marker stays as belt-and-braces: under HMR/dev, or
 *  if a second copy ever ships, the first one wins and no root builds its anchor
 *  map twice or registers a second set of listeners. */
function boot(): void {
  for (const root of Array.from(document.querySelectorAll<HTMLElement>(ROOT_SELECTOR))) {
    if (root.dataset.sectionTabsReady) continue;
    root.dataset.sectionTabsReady = '1';
    init(root);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// Marker, not an API: without a top-level import/export TypeScript treats this
// file as a global script, and its `boot` collides with the one in
// `lib/carousel.ts` ("Duplicate function implementation"). The module scope is
// also what keeps these helpers off `window`.
export {};
