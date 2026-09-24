// Theme behavior against the REAL built HTML (dist/). Extracts the two inline
// theme scripts from Base.astro (theme-init in <head>, theme-toggle at end of
// body) and runs them in jsdom to verify the three user-visible scenarios:
// switching, reload, and navigation between pages (MPA — each page load re-runs
// the head script, so persistence must come from localStorage).
//
// Requires `npm run build` first (reads dist/*.html).

import { describe, it, expect, beforeAll } from "bun:test";
import { JSDOM } from 'jsdom';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(__dirname, '../../dist');

// The built HTML is minified and adjacent inline scripts are merged into one
// <script> block, so we extract the two theme IIFEs by their marker comments
// and slice from the IIFE opening to its closing `})();`.
function extractThemeScripts(html: string): string[] {
  const out: string[] = [];
  const grab = (marker: string) => {
    const start = html.indexOf(marker);
    if (start === -1) return;
    const fnStart = html.indexOf('(function () {', start);
    if (fnStart === -1) return;
    const end = html.indexOf('})();', fnStart);
    if (end !== -1) out.push(html.slice(fnStart, end + 5));
  };
  grab('Prevent theme flash');
  grab('Theme toggle');
  return out;
}

interface Harness {
  store: Record<string, string>;
  getTheme: () => string | null;
  getThemeColor: () => string | null;
  clickToggle: () => void;
  getIcon: () => string | null;
  getAriaLabel: () => string | null;
}

function setup(htmlPath: string, savedTheme: string | null, prefersDark = false): Harness {
  const file = resolve(DIST, htmlPath);
  if (!existsSync(file)) throw new Error(`built page missing: ${htmlPath} — run npm run build first`);
  const html = readFileSync(file, 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://example.com/Personal_Projects.github.io/',
    runScripts: 'outside-only',
  });
  const { window } = dom;

  const store: Record<string, string> = savedTheme ? { theme: savedTheme } : {};
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    },
    configurable: true,
  });

  window.matchMedia = ((q: string) => ({
    matches: q.includes('dark') ? prefersDark : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  (window as unknown as { posthog: unknown }).posthog = { capture: () => {} };

  for (const script of extractThemeScripts(html)) {
    window.eval(script);
  }

  const toggle = window.document.getElementById('theme-toggle') as HTMLElement | null;
  return {
    store,
    getTheme: () => window.document.documentElement.getAttribute('data-theme'),
    getThemeColor: () =>
      window.document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
    clickToggle: () => toggle?.dispatchEvent(new window.Event('click')),
    getIcon: () => window.document.getElementById('theme-icon')?.getAttribute('icon') ?? null,
    getAriaLabel: () => toggle?.getAttribute('aria-label') ?? null,
  };
}

describe('theme (built HTML, real inline scripts)', () => {
  beforeAll(() => {
    if (!existsSync(resolve(DIST, 'index.html'))) {
      throw new Error('dist/ missing — run `npm run build` before this test');
    }
  });

  describe('switching (click cycles dark → light → cyberpunk → dark)', () => {
    it('cycles through all three themes and persists each to localStorage', () => {
      const h = setup('index.html', null, false); // prefersDark=false → default light
      expect(h.getTheme()).toBe('light');

      h.clickToggle(); // light → cyberpunk
      expect(h.getTheme()).toBe('cyberpunk');
      expect(h.store.theme).toBe('cyberpunk');

      h.clickToggle(); // cyberpunk → dark
      expect(h.getTheme()).toBe('dark');
      expect(h.store.theme).toBe('dark');

      h.clickToggle(); // dark → light
      expect(h.getTheme()).toBe('light');
      expect(h.store.theme).toBe('light');
    });

    it('updates theme-color meta and toggle aria-label on switch', () => {
      const h = setup('index.html', null, false);
      h.clickToggle(); // → cyberpunk
      expect(h.getThemeColor()).toBe('#0a0a12');
      expect(h.getAriaLabel()).toContain('cyberpunk');
    });
  });

  describe('reload (head script restores saved theme before first paint)', () => {
    it('restores a saved theme on a fresh page load', () => {
      const h = setup('index.html', 'cyberpunk');
      expect(h.getTheme()).toBe('cyberpunk');
      expect(h.getThemeColor()).toBe('#0a0a12');
    });

    it('restores light when saved', () => {
      const h = setup('index.html', 'light');
      expect(h.getTheme()).toBe('light');
    });

    it('falls back to prefers-color-scheme when nothing saved', () => {
      expect(setup('index.html', null, true).getTheme()).toBe('dark');
      expect(setup('index.html', null, false).getTheme()).toBe('light');
    });

    it('ignores an invalid saved value and falls back', () => {
      const h = setup('index.html', 'purple', true);
      expect(h.getTheme()).toBe('dark');
    });
  });

  describe('navigation between pages (MPA — each page re-reads localStorage)', () => {
    it('keeps the theme when moving to another page', () => {
      const a = setup('index.html', 'cyberpunk');
      expect(a.getTheme()).toBe('cyberpunk');

      // Simulate navigation: a fresh page load (different route) sharing the
      // same localStorage store.
      const b = setup('projects/index.html', a.store.theme);
      expect(b.getTheme()).toBe('cyberpunk');
    });

    it('keeps the theme across RU → EN pages', () => {
      const ru = setup('index.html', 'light');
      const en = setup('en/index.html', ru.store.theme);
      expect(en.getTheme()).toBe('light');
    });
  });
});
