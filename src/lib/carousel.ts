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

function createNav(nav: HTMLElement): Controller {
  const name = nav.dataset.carousel ?? '';
  const prev = nav.querySelector<HTMLButtonElement>('[data-carousel-prev]');
  const next = nav.querySelector<HTMLButtonElement>('[data-carousel-next]');
  const dotsEl = nav.querySelector<HTMLElement>('[data-carousel-dots]');
  let track: HTMLElement | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let frame = 0;

  function behaviour(): ScrollBehavior {
    return window.matchMedia(REDUCED_MOTION).matches ? 'auto' : 'smooth';
  }

  function currentPage(): number {
    if (!track || track.clientWidth === 0) return 0;
    return Math.round(track.scrollLeft / track.clientWidth);
  }

  function renderDots(pages: number): void {
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
    if (!scrollable) return;

    const pages = Math.max(1, Math.ceil(track.scrollWidth / track.clientWidth));
    if (dotsEl && dotsEl.childElementCount !== pages) renderDots(pages);

    const page = currentPage();
    if (prev) prev.disabled = track.scrollLeft <= 1;
    if (next) next.disabled = track.scrollLeft >= overflow - 1;
    if (dotsEl && !dotsEl.hidden) {
      for (const dot of dotsEl.children) {
        const el = dot as HTMLElement;
        if (Number(el.dataset.page) === page) el.setAttribute('aria-current', 'true');
        else el.removeAttribute('aria-current');
      }
    }
  }

  function onScroll(): void {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      sync();
    });
  }

  function step(direction: 1 | -1): void {
    if (!track) return;
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
      resizeObserver?.disconnect();
    }
    track = found;
    if (!track) {
      nav.hidden = true;
      return;
    }
    track.addEventListener('scroll', onScroll, { passive: true });
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
