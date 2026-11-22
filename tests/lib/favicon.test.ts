// The one rule that decides which tab icon a URL gets — the browser tab
// (`Base.astro`) and the site's own tab strip (`SiteTabs.astro`) both read it,
// so a disagreement here shows up as two different glyphs for one page.
//
// The cases pinned below are the seams: routes that are pages without being
// sections (article permalinks, the RU note indexes, contact/search/feedback),
// the demos hub against a standalone board, and the home page, which has no
// generated icon because the NB lettermark is its icon.
import { describe, it, expect } from 'bun:test';

import { faviconForPath, faviconKeyForPath } from '../../src/lib/favicon';

describe('faviconForPath', () => {
  it('resolves a section route to that section', () => {
    expect(faviconForPath('/projects/')).toBe('/icons/favicon-projects.svg');
    expect(faviconForPath('/projects/volta/retention/')).toBe('/icons/favicon-projects.svg');
    expect(faviconForPath('/en/projects/volta/retention/')).toBe('/icons/favicon-projects.svg');
    expect(faviconForPath('/hire/')).toBe('/icons/favicon-hire.svg');
    expect(faviconForPath('/en/glossary/window-function/')).toBe('/icons/favicon-glossary.svg');
  });

  it('keeps the brand mark for home and for a page outside the registry', () => {
    expect(faviconForPath('/')).toBe('/favicon.svg');
    expect(faviconForPath('/en/')).toBe('/favicon.svg');
    expect(faviconForPath('/unrouted-page/')).toBe('/favicon.svg');
  });

  it('maps the pages that are not sections: articles, notes, contact, search, feedback', () => {
    expect(faviconForPath('/posts/cohort-retention-guide/')).toBe('/icons/favicon-writing.svg');
    expect(faviconForPath('/en/posts/cohort-retention-guide/')).toBe('/icons/favicon-writing.svg');
    expect(faviconForPath('/notes/')).toBe('/icons/favicon-writing.svg');
    expect(faviconForPath('/notes/guides/')).toBe('/icons/favicon-writing.svg');
    expect(faviconForPath('/contact/')).toBe('/icons/favicon-contact.svg');
    expect(faviconForPath('/en/contact/')).toBe('/icons/favicon-contact.svg');
    expect(faviconForPath('/search/')).toBe('/icons/favicon-search.svg');
    expect(faviconForPath('/en/search/tag/rfm/')).toBe('/icons/favicon-search.svg');
    expect(faviconForPath('/feedback/')).toBe('/icons/favicon-feedback.svg');
    expect(faviconForPath('/en/feedback/')).toBe('/icons/favicon-feedback.svg');
  });

  it('separates the demos hub from a standalone board', () => {
    expect(faviconForPath('/demos/')).toBe('/icons/favicon-demos.svg');
    expect(faviconForPath('/en/demos/')).toBe('/icons/favicon-demos.svg');
    expect(faviconForPath('/demos/ab/')).toBe('/icons/favicon-board.svg');
    expect(faviconKeyForPath('/demos/volta-board/')).toBe('board');
  });

  it('gives the published static hubs their own glyph', () => {
    expect(faviconForPath('/games/')).toBe('/icons/favicon-games.svg');
    expect(faviconForPath('/diagrams/python.html')).toBe('/icons/favicon-diagram.svg');
  });
});
