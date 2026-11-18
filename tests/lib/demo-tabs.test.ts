// Chart tabs on the standalone demo boards (`public/demos/demo-tabs.js`).
//
// The boards are plain HTML in `public/`, copied verbatim by Astro — no Astro
// component can be mounted there, so the site's tab pattern
// (`src/components/SectionTabs.astro` + `src/lib/section-tabs-controller.ts`)
// was ported to one vanilla module. This file binds both halves:
//
//   · behaviour — the module is evaluated in jsdom against a fixture stack and
//     must produce one tablist, one visible panel, and move both on a click
//     (the failure it exists to prevent: tabs that toggle `aria-selected` while
//     the panels keep showing everything);
//   · wiring — every board with two or more cards on disk must load the script,
//     and the boards that deliberately do not (their own two-column layout or
//     their own switcher) are frozen in EXCLUDED, so a new board cannot ship
//     untabbed without this going red.
//
// Follows tests/built/toc.test.ts: the script text is read and evaluated in
// jsdom, so what ships is what is tested.

import { describe, it, expect } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const ROOT = resolve(__dirname, '..', '..');
const DEMOS = resolve(ROOT, 'public', 'demos');

// The board script is an ES module (it boots itself in a browser and stays
// inert here, where there is no `document` at import time), so the test imports
// it rather than re-parsing text: what ships is what is tested.
// @ts-ignore — public/demos is outside the TS project; the module has no types.
const tabs = (await import('../../public/demos/demo-tabs.js')) as unknown as {
  shortLabel: (title: string) => string;
  tailLabel: (title: string) => string;
  initDemoTabs: (doc: Document) => unknown;
};

function load(html: string) {
  const dom = new JSDOM(html, { pretendToBeVisual: true });
  tabs.initDemoTabs(dom.window.document);
  return dom;
}

const card = (title: string, body = '<svg></svg>') =>
  `<section class="demo-card"><h2 class="demo-title">${title}</h2>${body}</section>`;

const BOARD = `<!DOCTYPE html><html><body>
  <h1 class="demo-title">Доска</h1>
  <div class="stack">
    ${card('Воронка активации: каждый шаг считается только после предыдущего')}
    ${card('Удержание: 14 дневных когорт × окно D0–D6')}
    ${card('A/B-тест онбординга · control vs new_onboarding')}
  </div>
</body></html>`;

describe('shortLabel', () => {
  it('cuts at the first delimiter that leaves a real label', () => {
    const { shortLabel } = tabs;
    expect(shortLabel('Воронка активации: каждый шаг считается только после предыдущего')).toBe(
      'Воронка активации',
    );
    expect(shortLabel('Окно 12.10.2025 — 11.10.2026 целиком')).toBe('Окно 12.10.2025');
    expect(shortLabel('Масштаб и вес сборки · dist/')).toBe('Масштаб и вес сборки');
    expect(shortLabel('Движение MRR активной базы, по месяцам')).toBe('Движение MRR активной базы');
    // A delimiter inside the first six characters is not a label boundary.
    expect(shortLabel('A/B: pricing page redesign v2 · concluded')).toBe(
      'A/B: pricing page redesign v2',
    );
    // No delimiter, longer than the cap: cut on a word boundary.
    expect(shortLabel('Доверительный интервал разницы конверсий')).toBe(
      'Доверительный интервал…',
    );
    expect(shortLabel('')).toBe('');
    // A long segment after the delimiter is capped like any other label.
    expect(shortLabel('Что интерактивно в реальном приложении, а что — на этом борде')).toBe(
      'Что интерактивно в реальном…',
    );
  });
});

describe('initDemoTabs', () => {
  it('builds one tablist, keeps the first card and hides the rest', () => {
    const { document } = load(BOARD).window;
    const list = document.querySelectorAll('.demo-tablist');
    const tabs = document.querySelectorAll('[role="tab"]');
    const panels = document.querySelectorAll('[role="tabpanel"]');
    expect(list.length).toBe(1);
    expect(tabs.length).toBe(3);
    expect(panels.length).toBe(3);
    expect(Array.from(tabs).map((t) => t.textContent)).toEqual([
      'Воронка активации',
      'Удержание',
      'A/B-тест онбординга',
    ]);
    expect(Array.from(tabs).map((t) => t.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(Array.from(panels).map((p) => (p as HTMLElement).hidden)).toEqual([false, true, true]);
    // Every tab points at its own panel, and the panel back at the tab.
    for (const tab of Array.from(tabs)) {
      const panel = document.getElementById(tab.getAttribute('aria-controls') ?? '');
      expect(panel).not.toBeNull();
      expect(panel?.getAttribute('aria-labelledby')).toBe(tab.id);
    }
  });

  it('moves selection and visibility together on click', () => {
    const { document } = load(BOARD).window;
    const tabs = Array.from(document.querySelectorAll('[role="tab"]')) as HTMLElement[];
    const panels = Array.from(document.querySelectorAll('[role="tabpanel"]')) as HTMLElement[];
    tabs[2].click();
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true']);
    expect(panels.map((p) => p.hidden)).toEqual([true, true, false]);
    expect(tabs[2].tabIndex).toBe(0);
    expect(tabs[0].tabIndex).toBe(-1);
  });

  it('opens the panel a deep link points into', () => {
    const html = BOARD.replace('<svg></svg>', '<svg id="chart-title"></svg>');
    const { window } = load(html.replace('</body>', '</body>'));
    window.location.hash = '#chart-title';
    window.dispatchEvent(new window.Event('hashchange'));
    const panels = Array.from(window.document.querySelectorAll('[role="tabpanel"]')) as HTMLElement[];
    expect(panels[0].hidden).toBe(false);
    // Same document, a hash inside the SECOND card's heading id.
    const second = window.document.querySelectorAll('.demo-card')[1];
    second.insertAdjacentHTML('afterbegin', '<p id="retention"></p>');
    window.location.hash = '#retention';
    window.dispatchEvent(new window.Event('hashchange'));
    expect(panels.map((p) => p.hidden)).toEqual([true, false, true]);
  });

  it('ignores cards without a heading and groups cards in any container', () => {
    const kpi = '<div class="demo-card kpi"><div class="demo-kpi-value">23</div></div>';
    const { document } = load(
      `<!DOCTYPE html><html><body><div class="kpis">${kpi.repeat(4)}</div>
       <div>${card('Первый график')}${card('Второй график')}</div></body></html>`,
    ).window;
    const lists = document.querySelectorAll('.demo-tablist');
    expect(lists.length).toBe(1);
    expect(lists[0].querySelectorAll('[role="tab"]').length).toBe(2);
  });

  it('tells same-prefix headings apart by their tail', () => {
    const { document } = load(
      `<!DOCTYPE html><html><body><div class="stack">
        ${card('Market & Jobs — premium upsell')}
        ${card('Market & Jobs — referral conversion')}
        ${card('Market & Jobs — segment sizes')}
      </div></body></html>`,
    ).window;
    const labels = Array.from(document.querySelectorAll('[role="tab"]')).map((t) => t.textContent);
    expect(labels).toEqual(['Market & Jobs', 'referral conversion', 'segment sizes']);
  });

  it('leaves a single card alone', () => {
    const { document } = load(
      `<!DOCTYPE html><html><body><div class="stack">${card('Единственный график')}</div></body></html>`,
    ).window;
    expect(document.querySelectorAll('.demo-tablist').length).toBe(0);
  });

  it('does not tab cards nested inside a card', () => {
    const nested = `<section class="demo-card"><h2>Внешняя</h2><div class="col">
      ${card('Вложенная 1')}${card('Вложенная 2')}</div></section>${card('Вторая')}`;
    const { document } = load(
      `<!DOCTYPE html><html><body><div class="stack">${nested}</div></body></html>`,
    ).window;
    const lists = document.querySelectorAll('.demo-tablist');
    expect(lists.length).toBe(1);
    expect(lists[0].querySelectorAll('[role="tab"]').length).toBe(2);
  });
});

describe('wiring on disk', () => {
  // Boards that keep their own layout or switcher on purpose.
  const EXCLUDED = ['airflow', 'ml', 'scrolly', 'serp-rank'];

  const boards = readdirSync(DEMOS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((slug) => {
      try {
        return readFileSync(resolve(DEMOS, slug, 'index.html'), 'utf8').length > 0;
      } catch {
        return false;
      }
    });

  const html = (slug: string) => readFileSync(resolve(DEMOS, slug, 'index.html'), 'utf8');
  // Prefix match, not exact: volta's charts are `<section class="demo-card chart">`,
// and its KPI tiles are `<div class="demo-card kpi">` — the tag keeps them out.
  const cardCount = (slug: string) =>
    (html(slug).match(/<section class="demo-card/g) || []).length;

  it('every board with two or more cards loads the tabs script', () => {
    const expected = boards
      .filter((slug) => cardCount(slug) >= 2 && !EXCLUDED.includes(slug))
      .sort();
    const wired = boards.filter((slug) => html(slug).includes('demo-tabs.js')).sort();
    expect(wired).toEqual(expected);
    expect(expected.length).toBe(12);
  });

  it('the excluded boards still exist and still have their cards', () => {
    for (const slug of EXCLUDED) {
      expect(boards).toContain(slug);
      expect(cardCount(slug)).toBeGreaterThanOrEqual(2);
      expect(html(slug)).not.toContain('demo-tabs.js');
    }
  });
});
