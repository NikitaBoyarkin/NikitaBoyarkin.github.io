import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  advertisedTabs,
  dctVersion,
  findProjectDir,
  mergeTabs,
  PINNED_DCT_VERSION,
  tabsOf,
} from '../../scripts/build-volta-board.mjs';

// `scripts/build-volta-board.mjs` exists because a static `dct render --format
// html` export carries one tab and links the rest to `?..._tab_<board>=<tab>`,
// a parameter only a live `dct serve` host answers. On GitHub Pages the board's
// five tabs did not switch and the artifact shipped 2 charts of 20.
//
// These cases bind the merge to that contract: every rendered tab reaches the
// page, the ~620 KB font block is paid for once, the links become `?tab=`, and
// a board that grew a tab fails the build instead of losing it silently.
//
// The fixtures are hand-built rather than real renders: five 700 KB documents
// per test run would make `bun test tests/lib` unusable, and the merge only ever
// looks at the container, the bar, the `<style>` blocks and the head.

const KEYS = ['onboarding', 'kyc_ab_test', 'retention'];

const FONTS = "@font-face { font-family: 'Inter Variable'; src: url(data:font/woff2;base64,AAAA) }";

/** One `dct render --format html` page, as the merge sees it. */
function render(key: string, others: string[], options: { style?: string; charts?: number } = {}) {
  const style = options.style ?? FONTS;
  const charts = options.charts ?? 1;
  const links = others
    .map(
      (tab) =>
        `<a href="?device=%5B%22android%22%5D&amp;_tab_volta_neobank_core_analytics=${tab}"><text>${tab}</text></a>`,
    )
    .join('');
  const marks = '<g data-chart-id="chart_' + key + '"></g>'.repeat(charts);
  const svg = `<svg viewBox="0 0 10 10" data-dbt-page-title="Board"><defs><style>${style}</style></defs>${links}${marks}</svg>`;
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Board</title>
</head>
<body>
    <div class="dbt-charts-wrapper">
        <div class="dbt-charts-svg-container dbt-charts-board" data-dbt-board>${svg}</div>
    </div>
    <script>window.boardRuntime = true;</script>
</body>
</html>`;
}

function pages(keys: string[] = KEYS, options: { style?: string } = {}) {
  return keys.map((key, index) => ({
    key,
    html: render(key, keys.filter((_, at) => at !== index), options),
  }));
}

describe('mergeTabs', () => {
  it('writes one pane per tab, the first open and the rest switchable', () => {
    const merged = mergeTabs(pages());

    expect(merged.match(/data-dbt-tab-pane="/g)?.length).toBe(KEYS.length);
    for (const key of KEYS) expect(merged).toContain(`data-dbt-tab-pane="${key}"`);
    expect(merged).toContain('class="dbt-tab-pane dbt-tab-active" data-dbt-tab-pane="onboarding"');
    // Panes are plain children of the board container, so page.css still sizes
    // the board's own <svg> through the pane.
    expect(merged).toContain('dbt-charts-svg-container dbt-charts-board" data-dbt-board>\n            <div');
  });

  it('turns every tab link into a ?tab= deep link the switcher owns', () => {
    const merged = mergeTabs(pages());

    expect(merged).not.toContain('_tab_volta_neobank_core_analytics');
    expect(merged).toContain('href="?tab=kyc_ab_test"');
    expect(merged).toContain('href="?tab=retention"');
    expect(merged).toContain('href="?tab=onboarding"');
  });

  it('keeps one copy of the font and chart CSS block, not one per tab', () => {
    const merged = mergeTabs(pages());

    expect(merged.split(FONTS).length - 1).toBe(1);
    // Two blocks in the whole document: the fonts the first render shipped and
    // this script's pane/view CSS. Three tabs in, two font copies dropped.
    expect(merged.split('<style>').length - 1).toBe(2);
  });

  it('boots with the tabs class so only the open pane paints, and stays readable without JS', () => {
    const merged = mergeTabs(pages());

    expect(merged).toContain("document.documentElement.classList.add('dbt-tabs-js')");
    expect(merged).toContain('.dbt-tabs-js .dbt-tab-pane.dbt-tab-active');
    // No pane is `hidden` in the markup: a reader with no JS gets the whole board.
    expect(merged).not.toMatch(/data-dbt-tab-pane="[a-z_]+"\s+hidden/);
  });

  it('keeps the runtime script the render shipped, once', () => {
    const merged = mergeTabs(pages());

    expect(merged.split('window.boardRuntime = true').length - 1).toBe(1);
  });

  it('refuses a render whose bar does not advertise a sibling tab', () => {
    const broken = pages();
    broken[2] = { key: 'retention', html: render('retention', ['onboarding'], {}) };

    expect(() => mergeTabs(broken)).toThrow(/does not advertise kyc_ab_test/);
  });

  it('refuses a board that grew a tab with no render for it', () => {
    const grown = pages();
    grown[0] = { key: 'onboarding', html: render('onboarding', ['kyc_ab_test', 'retention', 'forecast'], {}) };

    expect(() => mergeTabs(grown)).toThrow(/a tab was added to the board/);
  });

  it('refuses to drop a font block that is not byte-identical', () => {
    const drifted = pages();
    drifted[1] = { key: 'kyc_ab_test', html: render('kyc_ab_test', ['onboarding', 'retention'], { style: FONTS + '/* patched */' }) };

    expect(() => mergeTabs(drifted)).toThrow(/differ from the first tab/);
  });

  it('needs at least two tabs — one render is not a tabs layout', () => {
    expect(() => mergeTabs([{ key: 'onboarding', html: render('onboarding', []) }])).toThrow(/at least two/);
  });
});

describe('advertisedTabs', () => {
  it('adds the page’s own tab to the ones its bar links to', () => {
    const html = render('retention', ['onboarding', 'kyc_ab_test']);
    const svg = /data-dbt-board>(<svg[\s\S]*?)<\/div>/.exec(html)?.[1] ?? '';

    expect([...advertisedTabs(svg, 'retention')].sort()).toEqual(['kyc_ab_test', 'onboarding', 'retention']);
  });
});

describe('tabsOf', () => {
  const describe = (over: Record<string, unknown> = {}) => ({
    success: true,
    variables: [
      { name: 'device', type: 'multiselect', default: ['a'], options: ['a', 'b'] },
      { name: '_tab_volta_neobank_core_analytics', type: 'select', default: 'onboarding', options: KEYS },
    ],
    ...over,
  });

  it('reads the tab order and the default tab from dct describe', () => {
    expect(tabsOf(describe())).toEqual({
      variable: '_tab_volta_neobank_core_analytics',
      default: 'onboarding',
      keys: KEYS,
    });
  });

  it('falls back to the first option when the default is not one of them', () => {
    const board = describe();
    board.variables[1] = { ...board.variables[1], default: 'gone' };

    expect(tabsOf(board).default).toBe('onboarding');
  });

  it('fails loudly on a board that has no tabs, instead of rendering one pane', () => {
    expect(() => tabsOf({ success: true, variables: [{ name: 'device' }] })).toThrow(/not a tabs layout/);
    expect(() =>
      tabsOf({
        success: true,
        variables: [{ name: '_tab_x', default: 'only', options: ['only'] }],
      }),
    ).toThrow(/not a tabs layout/);
  });
});

describe('findProjectDir', () => {
  it('resolves the board’s project root from a chart path inside the repo', () => {
    const root = resolve(__dirname, '..', '..');

    expect(findProjectDir(resolve(root, 'charts', 'web-vitals.yml'))).toBe(root);
  });
});

describe('the deploy pin', () => {
  it('reads the version out of `dct --version`', () => {
    expect(dctVersion('dct 0.9.1 from /Users/x/.local/share/uv/tools/dbt-charts (Python 3.14.2)')).toBe('0.9.1');
    expect(dctVersion('')).toBeNull();
  });

  it('is the one the deploy actually installs', () => {
    const workflow = readFileSync(
      resolve(__dirname, '..', '..', '.github', 'workflows', 'deploy.yml'),
      'utf8',
    );

    // A local build with a different dbt-charts produces a different artifact
    // than the one CI renders, so the warning and the pin must agree.
    expect(workflow).toContain(`dbt-charts==${PINNED_DCT_VERSION}`);
  });
});

describe('the committed board the deploy ships', () => {
  const committed = readFileSync(resolve(__dirname, '..', '..', 'public', 'demos', 'volta-board', 'index.html'), 'utf8');

  it('carries every tab, not just the one the static export shows', () => {
    const panes = committed.match(/data-dbt-tab-pane="/g) ?? [];

    expect(panes.length).toBe(5);
    for (const key of ['onboarding', 'kyc_ab_test', 'retention', 'causal_did', 'segmentation']) {
      expect(committed).toContain(`data-dbt-tab-pane="${key}"`);
    }
    // 20 charts, as the case page claims — a single-tab export carried 2.
    expect(committed.match(/data-chart-id="/g)?.length).toBe(20);
  });

  it('has no dead `_tab_` links left for a `dct serve` host to answer', () => {
    expect(committed).not.toContain('_tab_volta_neobank_core_analytics');
    expect(committed).toContain('href="?tab=segmentation"');
  });

  it('pays for the embedded fonts once', () => {
    expect(committed.split('<style type="text/css">').length - 1).toBe(1);
  });
});
