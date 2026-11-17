// The survey must survive with JavaScript off: a native form posts to the Edge
// Function and gets its HTML answer back. A source test would miss that, and a
// browser test would not check the sitemap exclusion. Asserted against dist/.
//
// Requires `bun run build` first.

import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');

const page = (path: string): string => readFileSync(resolve(DIST, `.${path}`), 'utf8');

const RU = '/feedback/index.html';
const EN = '/en/feedback/index.html';

describe('feedback page is unlisted', () => {
  it('carries a robots meta in the head', () => {
    for (const path of [RU, EN]) {
      expect(page(path)).toContain('<meta name="robots" content="noindex, follow"');
    }
  });

  it('is absent from the sitemap', () => {
    const sitemap = page('/sitemap-0.xml');
    expect(sitemap).not.toContain('/feedback/');
  });
});

describe('feedback form works without javascript', () => {
  it('posts five answers, a role, a locale, a signature and a honeypot', () => {
    const html = page(RU);
    expect(html).toContain('<form');
    expect(html).toMatch(/method="post"/);
    expect(html).toMatch(/action="https:\/\/[^"]+\/functions\/v1\/feedback"/);
    for (const name of ['q_task', 'q_helps', 'q_friction', 'q_gap', 'q_more', 'role', 'locale', 'signature', 'website']) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html.match(/<textarea/g)?.length).toBe(5);
  });

  it('keeps the honeypot out of the accessibility tree', () => {
    const html = page(RU);
    const at = html.indexOf('name="website"');
    expect(at).toBeGreaterThan(-1);
    expect(html.slice(Math.max(0, at - 400), at)).toContain('aria-hidden="true"');
  });

  it('asks in the page language', () => {
    expect(page(RU)).toContain('С какой задачей вы бы позвали меня завтра?');
    expect(page(EN)).toContain('What task would you call me for tomorrow?');
  });
});

describe('hire links to feedback', () => {
  it('the RU page offers the survey and tags the click', () => {
    const html = page('/hire/index.html');
    expect(html).toContain('href="/feedback/"');
    expect(html).toContain('data-analytics="feedback_page_click"');
  });

  it('the EN page points at its own locale route', () => {
    expect(page('/en/hire/index.html')).toContain('href="/en/feedback/"');
  });
});
