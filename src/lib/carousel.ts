/** Arrow + dot controls for the horizontal snap tracks.
 *
 *  CSS owns the track itself (`overflow-x`, `scroll-snap-type`, card width) and
 *  a track stays fully usable without this module: it scrolls by touch, by
 *  trackpad and by keyboard, because the cards are links and therefore
 *  focusable. This module only adds the two things CSS cannot — buttons that
 *  move the row, and an indicator of where in the row you are.
 *
 *  A track is found by attribute, not by id, because `BlogFilter` replaces
 *  `#blog-list` with a fresh `#blog-filter-results` on the first filter click.
 *  The controller therefore re-resolves its track whenever `carousel:refresh`
 *  fires and whenever the window resizes across a layout breakpoint.
 */

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
/** A dot per screenful stops being an indicator and becomes a ladder. Twelve
 *  is the point where `/writing/` on a 390px phone (9 pages of 10 cards) still
 *  gets its dots while a 27-card board does not; there the arrows carry it. */
const MAX_DOTS = 12;

interface Controller {
  refresh(): void;
}

function pickTrack(name: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(`[data-carousel-track="${name}"]`);
  for (const el of candidates) {
    // `hidden` covers the filter swap; `getClientRects()` catches the widths
    // where the track is a plain grid and has scrolled nowhere.
    if (el.hidden || el.getClientRects().length === 0) continue;
    return el;
  }
  return null;
}

function label(page: number, pages: number): string {
  const lang = document.documentElement.lang;
  return lang === 'en' ? `Page ${page} of ${pages}` : `Страница ${page} из ${pages}`;
}

/** `aria-disabled`, never `disabled`: a focused button that turns `disabled` is
 *  dropped from the tab order, focus falls to `<body>` and a keyboard reader is
 *  thrown back to the top of the document mid-task (WCAG 2.4.3). The arrow stays
 *  focusable; `step()` refuses the no-op so a click at either end does nothing. */
function setDisabled(button: HTMLButtonElement | null, off: boolean): void {
  if (!button) return;
  if (off) button.setAttribute('aria-disabled', 'true');
  else button.removeAttribute('aria-disabled');
}

function createNav(nav: HTMLElement): Controller {
  const name = nav.dataset.carousel ?? '';
  const prev = nav.querySelector<HTMLButtonElement>('[data-carousel-prev]');
  const next = nav.querySelector<HTMLButtonElement>('[data-carousel-next]');
  const dotsEl = nav.querySelector<HTMLElement>('[data-carousel-dots]');
  // Past `MAX_DOTS` the dots are dropped, and with them the only visual answer
  // to "where am I in the row" — so the position is announced instead. Built
  // here rather than in the component so the markup stays identical for the
  // tracks that never need it.
  const statusEl = document.createElement('span');
  statusEl.className = 'visually-hidden';
  statusEl.setAttribute('role', 'status');
  // Silent until the reader moves the row: `role="status"` implies `polite`, and
  // an explicit value wins, so the first "Страница 1 из 25" never speaks on load.
  statusEl.setAttribute('aria-live', 'off');
  // Before the next arrow, so the reading order is "Назад → Страница 3 из 25 →
  // Вперёд" rather than a number trailing the controls it describes.
  if (next) next.before(statusEl);
  else nav.append(statusEl);
  let track: HTMLElement | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let frame = 0;
  /** Page count the dots were last built for. Reading `childElementCount`
   *  instead was wrong the moment the dots were hidden: `renderDots` leaves
   *  zero children in that case, so the comparison never matched and every
   *  scroll frame rebuilt the whole ladder. */
  let renderedPages = 0;

  /** The position text is always present, but spoken only from the moment the
   *  reader moves the row — and only where the dots cannot answer: a visible dot
   *  already carries `aria-label="Страница 3 из 9"` and `aria-current`. */
  function announceOnMove(): void {
    if (dotsEl && !dotsEl.hidden) return;
    statusEl.setAttribute('aria-live', 'polite');
  }

  function behaviour(): ScrollBehavior {
    return window.matchMedia(REDUCED_MOTION).matches ? 'auto' : 'smooth';
  }

  function currentPage(): number {
    if (!track || track.clientWidth === 0) return 0;
    return Math.round(track.scrollLeft / track.clientWidth);
  }

  function renderDots(pages: number): void {
    renderedPages = pages;
    if (!dotsEl) return;
    dotsEl.textContent = '';
    dotsEl.hidden = pages > MAX_DOTS;
    if (dotsEl.hidden) return;
    for (let i = 0; i < pages; i += 1) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel-dot';
      dot.dataset.page = String(i);
      dot.setAttribute('aria-label', label(i + 1, pages));
      dot.addEventListener('click', () => {
        announceOnMove();
        track?.scrollTo({ left: i * (track.clientWidth || 0), behavior: behaviour() });
      });
      dotsEl.append(dot);
    }
  }

  function sync(): void {
    if (!track) return;
    const overflow = track.scrollWidth - track.clientWidth;
    const scrollable = overflow > 1;
    nav.hidden = !scrollable;
    if (!scrollable) {
      // The row stopped overflowing (window widened, or a filtered list shrank).
      // The controls are hidden, but a stale position would be read as the
      // current one the moment another track is picked up.
      statusEl.textContent = '';
      statusEl.setAttribute('aria-live', 'off');
      return;
    }

    // Count the positions the row can actually snap to, not the page the
    // content would fill: the last scroll offset is `scrollWidth - clientWidth`,
    // so a 24.5-screen row reaches page 23 of 25 and the terminal position
    // would announce "Страница 24 из 25" while Вперёд is already disabled.
    const pages = Math.max(1, Math.round(overflow / track.clientWidth) + 1);
    if (dotsEl && renderedPages !== pages) renderDots(pages);

    const page = currentPage();
    setDisabled(prev, track.scrollLeft <= 1);
    setDisabled(next, track.scrollLeft >= overflow - 1);
    if (dotsEl && !dotsEl.hidden) {
      for (const dot of dotsEl.children) {
        const el = dot as HTMLElement;
        if (Number(el.dataset.page) === page) el.setAttribute('aria-current', 'true');
        else el.removeAttribute('aria-current');
      }
      // The dots answer "where am I" on their own, each labelled "Страница 3 из
      // 9". So the text is dropped and the region disarmed — otherwise a resize
      // that brings the dots back would keep announcing a position already shown.
      statusEl.textContent = '';
      statusEl.setAttribute('aria-live', 'off');
    } else {
      // Past `MAX_DOTS` the dots are gone and this text is the only answer to
      // "where in the row am I, and how many pages are there" (WCAG 1.3.1).
      // Written only on change — `sync` runs once per scroll frame and every
      // mutation of a live region is re-announced.
      const text = label(page + 1, pages);
      if (statusEl.textContent !== text) statusEl.textContent = text;
    }
  }

  function onScroll(): void {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      sync();
    });
  }

  /** WCAG 2.4.7: tabbing to a control inside a card that is only partly in view
   *  scrolls it in, then `scroll-snap-type: x mandatory` snaps the row back and
   *  the focus ring lands outside the scrollport. Aligning the card itself — not
   *  the link inside it — targets a snap position, so the row does not move back.
   *  This cannot be done in CSS: `scroll-margin` on the card shifts the snap area
   *  while the browser reads the *link's* `scroll-margin` when it scrolls focus
   *  into view, so the two disagree. */
  function onFocusIn(event: FocusEvent): void {
    if (!track) return;
    if (track.scrollWidth - track.clientWidth < 2) return;
    const target = event.target as HTMLElement;
    if (!target.matches(':focus-visible')) return;
    const card = Array.from(track.children).find((child) => child.contains(target));
    if (!(card instanceof HTMLElement)) return;
    // Already whole in view: moving the row here would hide the card the reader
    // just came from — three cards fit on one screen at desktop widths.
    const box = track.getBoundingClientRect();
    const rect = card.getBoundingClientRect();
    if (rect.left >= box.left - 2 && rect.right <= box.right + 2) return;
    card.scrollIntoView({ inline: 'start', block: 'nearest', behavior: 'auto' });
  }

  function step(direction: 1 | -1): void {
    if (!track) return;
    if (direction === -1 && track.scrollLeft <= 1) return;
    if (direction === 1 && track.scrollLeft >= track.scrollWidth - track.clientWidth - 1) return;
    announceOnMove();
    // A hair less than a full screenful so a card never lands exactly on the
    // edge of two pages and snap has an unambiguous nearest target.
    track.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: behaviour() });
  }

  prev?.addEventListener('click', () => step(-1));
  next?.addEventListener('click', () => step(1));

  function attach(): void {
    const found = pickTrack(name);
    if (found === track) {
      sync();
      return;
    }
    if (track) {
      track.removeEventListener('scroll', onScroll);
      track.removeEventListener('focusin', onFocusIn);
      resizeObserver?.disconnect();
    }
    track = found;
    if (!track) {
      nav.hidden = true;
      return;
    }
    track.addEventListener('scroll', onScroll, { passive: true });
    track.addEventListener('focusin', onFocusIn);
    resizeObserver = new ResizeObserver(() => sync());
    resizeObserver.observe(track);
    sync();
  }

  attach();
  return { refresh: attach };
}

const controllers = new Map<string, Controller>();

function boot(): void {
  for (const nav of document.querySelectorAll<HTMLElement>('[data-carousel]')) {
    const name = nav.dataset.carousel;
    if (!name || controllers.has(name)) continue;
    controllers.set(name, createNav(nav));
  }
  for (const controller of controllers.values()) controller.refresh();
}

boot();
window.addEventListener('resize', () => {
  for (const controller of controllers.values()) controller.refresh();
});
document.addEventListener('carousel:refresh', () => {
  for (const controller of controllers.values()) controller.refresh();
});
