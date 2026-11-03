// The pre-rename base path `/Personal_Projects.github.io/` stopped resolving when
// the repo became a user site (PRD v6 S1.1). Two mechanisms put it back, and both
// fail silently: the exact config redirect for the prefix root, and the 404-page
// handler for nested paths (GitHub Pages serves 404.html for every unknown path
// and cannot issue a 301 for a static site). The handler's mapping is executed
// here rather than grepped, so a broken condition fails the test.
//
// Requires `bun run build` first (reads dist/).

import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');
const PREFIX = '/Personal_Projects.github.io';

describe('legacy /Personal_Projects.github.io/ prefix', () => {
  it('redirects the prefix root with a meta refresh and canonical', () => {
    const html = readFileSync(resolve(DIST, 'Personal_Projects.github.io/index.html'), 'utf8');
    expect(html).toContain('http-equiv="refresh"');
    expect(html).toContain('url=/');
    expect(html).toContain('rel="canonical" href="https://nikitaboyarkin.github.io/"');
  });

  it('strips the prefix for deep paths from the 404 page', () => {
    const html = readFileSync(resolve(DIST, '404.html'), 'utf8');
    const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
      .map((m) => m[1])
      .find((body) => body.includes(PREFIX));
    expect(script).toBeDefined();

    const run = (pathname: string, search = '', hash = '') => {
      const location: {
        pathname: string;
        search: string;
        hash: string;
        result?: string;
        replace: (url: string) => void;
      } = {
        pathname,
        search,
        hash,
        replace: (url: string) => {
          location.result = url;
        },
      };
      new Function('location', script!)(location);
      return location.result;
    };

    expect(run(`${PREFIX}/`)).toBe('/');
    expect(run(PREFIX)).toBe('/');
    expect(run(`${PREFIX}/graph/`)).toBe('/graph/');
    expect(run(`${PREFIX}/projects/`, '?ref=x', '#top')).toBe('/projects/?ref=x#top');
    expect(run('/about/')).toBeUndefined();
  });
});
