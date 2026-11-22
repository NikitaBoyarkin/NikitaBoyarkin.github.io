/**
 * Which tab icon a URL gets — one rule, two consumers.
 *
 * `Base.astro` uses it for `<link rel="icon">` in the served HTML, and
 * `SiteTabs.astro` uses it for the glyph beside each tab in the site's own
 * browser-style strip, so the two can never disagree about what section a page
 * belongs to.
 *
 * The registry (`SECTIONS` via `sectionForPath`) answers for every route the
 * drawer names. The exceptions below are routes that are pages without being
 * sections: the article permalinks live under `/posts/` while the section route
 * is `/writing/`, the RU note indexes sit at `/notes/`, and contact, search and
 * feedback are single pages. `demos/<slug>/` is a standalone board while
 * `/demos/` is the hub — the hub keeps the demos glyph, the board gets its own.
 */
import { sectionForPath } from './sections';

const strip = (pathname: string) => pathname.replace(/^\/+|\/+$/g, '');

/** Section (or page group) key for a path, or `null` for the brand mark. */
export function faviconKeyForPath(pathname: string): string | null {
  const segments = strip(pathname).split('/').filter(Boolean);
  const [first, second] = segments;
  const en = first === 'en';
  const rest = en ? second : first;

  if (rest === 'contact') return 'contact';
  if (rest === 'search') return 'search';
  if (rest === 'feedback') return 'feedback';
  /* `/posts/<slug>/` is an article; `/writing/` is its section route. The RU
     note and guide indexes belong to the same family. */
  if (rest === 'posts' || rest === 'notes') return 'writing';
  /* A standalone board under `public/demos/<slug>/` gets the chart glyph; the
     hub at `/demos/` is matched by the registry below and keeps the demos one. */
  if (rest === 'demos' && segments.length > (en ? 2 : 1)) return 'board';
  if (rest === 'games') return 'games';
  if (rest === 'diagrams') return 'diagram';

  return sectionForPath(pathname);
}

/** `public/` path of the icon, leading slash included; the brand mark as fallback. */
export function faviconForPath(pathname: string): string {
  const key = faviconKeyForPath(pathname);
  /* `home` has no generated file on purpose (the NB lettermark IS its icon), so
     both it and an unrouted page fall back to the brand mark — the same file the
     browser tab then shows. */
  if (!key || key === 'home') return '/favicon.svg';
  return `/icons/favicon-${key}.svg`;
}
