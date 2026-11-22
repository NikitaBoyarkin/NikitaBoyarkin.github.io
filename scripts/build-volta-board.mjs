#!/usr/bin/env node
/**
 * Fold the Volta board's tabs into one self-contained demo page.
 *
 * ## Why this exists
 *
 * A static `dct render --format html` export carries **one** tab. dbt-charts
 * scopes a render to the tab its layout shows (`scope_tabs` empties the rest),
 * so the other four become links to `?…_tab_volta_neobank_core_analytics=…`,
 * a query parameter only a live `dct serve` host can answer. On GitHub Pages a
 * click reloads the same URL and the same tab comes back — the board's "5
 * вкладок" simply did not switch, and the artifact shipped 2 charts of 20.
 *
 * This script renders every tab and folds the five board SVGs into one
 * document. The tabs stay tabs; the page stays one file you can open from disk.
 *
 * ## What it guarantees
 *
 * 1. **Every tab is in the file.** With JS off the page is the whole board in
 *    one scroll — no pane is `hidden` until the inline boot script in the head
 *    sets `dbt-tabs-js` on `<html>`. Same progressive-enhancement rule as
 *    `public/demos/demo-tabs.js`.
 * 2. **The fonts are paid for once.** Each board SVG carries an identical
 *    ~620 KB `<style>` (four `@font-face` blobs). Copies after the first are
 *    dropped after a byte-compare, so the merged page is ~1 MB, not ~3.5 MB.
 * 3. **The site-owned head survives.** CI re-renders the board on every deploy
 *    and the render carries charset, viewport and `<title>` only; the
 *    description, canonical and OG block live in the committed copy and come
 *    back through `reapplyHead()` — the same function, not a second copy of it.
 * 4. **Drift fails the build.** The tab list comes from `dct describe --json`
 *    (the `_tab_…` variable's `options`), so a tab added to the YAML is
 *    rendered instead of silently dropped; each render is checked to advertise
 *    exactly that list.
 *
 * Usage:
 *   node scripts/build-volta-board.mjs --board <charts/volta-core.yml> \
 *     [--project-dir <dir>] [--out <public/demos/volta-board/index.html>] \
 *     [--head-source <committed/index.html>] [--dct <dct binary>]
 *
 *   bun run board:volta          # the dev-machine shorthand
 *
 * `--dct` defaults to `$DCT_BIN`, then `dct` on PATH. The deploy pins
 * dbt-charts 0.9.1 (`vendor/volta-banking` is the board's source of truth).
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { reapplyHead } from './reapply-demo-head.mjs';

/**
 * The dbt-charts release the deploy renders with (`.github/workflows/deploy.yml`).
 * A different local `dct` produces a different artifact — fonts, chart CSS and
 * table runtime all move between releases — so a mismatch is reported instead of
 * silently committing a page the deploy will replace.
 * `tests/lib/volta-board-tabs.test.ts` binds this string to the workflow pin.
 */
export const PINNED_DCT_VERSION = '0.9.1';

/** The board's single child inside `dbt-charts-svg-container`. */
const BOARD_CONTAINER =
  /(<div class="dbt-charts-svg-container dbt-charts-board" data-dbt-board>)\s*(<svg[\s\S]*?)\s*<\/div>/;

const STYLE_BLOCK = /<style[^>]*>[\s\S]*?<\/style>/g;

/** The tab the board's layout shows, as its bar advertises it. */
const TAB_PARAM = /_tab_[A-Za-z0-9_]+=([a-z0-9_]+)/g;

/** An `href` that names a tab; the only links the switcher intercepts. */
const TAB_HREF = /href="\?[^"]*?_tab_[A-Za-z0-9_]+=([a-z0-9_]+)[^"]*"/g;

const PAGE_CSS = `
    <style>
        /* One board per tab, in one document.
         *
         * A static \`dct render --format html\` export carries only the tab its
         * layout shows and turns the rest of the bar into links to
         * \`?_tab_<board>=<tab>\`, which only a \`dct serve\` host can answer — on a
         * static host a click reloads the same tab. This page carries every tab
         * and switches between them in place.
         *
         * Progressive enhancement: without JS every pane stays visible and the
         * page is the whole board in one scroll — nothing is hidden that the
         * reader cannot reach. \`dbt-tabs-js\` (set by the inline boot script
         * below) is what turns the panes into tabs.
         *
         * Child combinator on purpose, as in page.css: a descendant selector
         * would also hit the nested per-chart svg viewports and re-center their
         * viewBox content. */
        .dbt-tabs-js .dbt-tab-pane {
            display: none;
        }
        .dbt-tabs-js .dbt-tab-pane.dbt-tab-active {
            display: block;
        }
        .dbt-charts-svg-container > .dbt-tab-pane > svg {
            width: 100%;
            height: auto;
        }
        .dbt-view-fit-height .dbt-charts-svg-container > .dbt-tab-pane > svg {
            width: auto;
            height: calc(100vh - var(--dbt-view-chrome, 0px));
            max-width: 100%;
            margin-inline: auto;
        }
        .dbt-view-actual .dbt-charts-svg-container > .dbt-tab-pane > svg {
            width: auto;
            height: auto;
            max-width: none;
            margin-inline: auto;
        }
    </style>
    <script>document.documentElement.classList.add('dbt-tabs-js');</script>`;

const SWITCHER = `
    <script>(function () {
        var panes = Array.prototype.slice.call(document.querySelectorAll('[data-dbt-tab-pane]'));
        if (panes.length < 2) return;
        var keys = panes.map(function (pane) { return pane.getAttribute('data-dbt-tab-pane'); });

        function requested() {
            var match = /[?&]tab=([^&#]*)/.exec(window.location.search);
            return match ? decodeURIComponent(match[1]) : '';
        }

        function show(key) {
            if (keys.indexOf(key) < 0) key = keys[0];
            panes.forEach(function (pane) {
                pane.classList.toggle('dbt-tab-active', pane.getAttribute('data-dbt-tab-pane') === key);
            });
            // A pane that was hidden measured 0 for anything that reads
            // clientWidth on first paint (the table runtime), so nudge it once
            // the newly shown pane has layout.
            window.requestAnimationFrame(function () {
                window.dispatchEvent(new Event('resize'));
            });
        }

        show(requested() || keys[0]);

        document.addEventListener('click', function (event) {
            var anchor = event.target.closest ? event.target.closest('a[href*="tab="]') : null;
            if (!anchor || !anchor.closest('[data-dbt-tab-pane]')) return;
            var match = /[?&]tab=([^&#]*)/.exec(anchor.getAttribute('href') || '');
            if (!match) return;
            event.preventDefault();
            var key = decodeURIComponent(match[1]);
            show(key);
            try {
                window.history.replaceState(null, '', '?tab=' + encodeURIComponent(key));
            } catch (error) {
                // file:// and a few embedded contexts refuse history writes.
            }
        });
    })();</script>`;

/** Stable short hash of one `<style>` block, for the dedupe decision. */
function styleSignature(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/** The board `<svg>` and the container line that opens it. */
function boardOf(html, label) {
  const match = BOARD_CONTAINER.exec(html);
  if (!match) throw new Error(`${label}: no board container found — is this a dct html render?`);
  return { open: match[1], svg: match[2] };
}

/** The tabs a board's own bar advertises, plus the tab this page shows. */
export function advertisedTabs(svg, own) {
  const keys = new Set([...svg.matchAll(TAB_PARAM)].map((match) => match[1]));
  if (own) keys.add(own);
  return keys;
}

/**
 * Fold `pages` — `[{ key, html }]` in tab order — into one document.
 *
 * Pure, so `tests/lib/volta-board-tabs.test.ts` can drive it with fixtures
 * instead of five 700 KB renders.
 */
export function mergeTabs(pages) {
  if (!Array.isArray(pages) || pages.length < 2) {
    throw new Error('mergeTabs: needs at least two rendered tabs');
  }
  const keys = pages.map((page) => page.key);
  const expected = new Set(keys);

  const docs = pages.map((page) => {
    const board = boardOf(page.html, page.key);
    const advertised = advertisedTabs(board.svg, page.key);
    const missing = keys.filter((key) => !advertised.has(key));
    if (missing.length) {
      throw new Error(`${page.key}: tab bar does not advertise ${missing.join(', ')}`);
    }
    const extra = [...advertised].filter((key) => !expected.has(key));
    if (extra.length) {
      throw new Error(
        `${page.key}: tab bar advertises ${extra.join(', ')} — a tab was added to the board but no render was made for it`,
      );
    }
    return { key: page.key, html: page.html, board };
  });

  // The `<style>` blocks inside a board SVG (the fonts and the chart CSS) are
  // byte-identical across tabs: keep the first copy, drop the rest.
  const first = [...docs[0].board.svg.matchAll(STYLE_BLOCK)].map((match) => styleSignature(match[0]));
  for (const doc of docs.slice(1)) {
    const signature = [...doc.board.svg.matchAll(STYLE_BLOCK)].map((match) => styleSignature(match[0]));
    if (JSON.stringify(signature) !== JSON.stringify(first)) {
      throw new Error(`${doc.key}: board <style> blocks differ from the first tab — refusing to drop the copies`);
    }
    doc.board.svg = doc.board.svg.replace(STYLE_BLOCK, '');
  }

  const panes = docs
    .map((doc) => {
      const svg = doc.board.svg.replace(TAB_HREF, (_all, key) => `href="?tab=${key}"`);
      // The first pane is the one the boot script leaves open when the URL
      // names no tab; callers order `pages` with the board's default tab first.
      const active = doc === docs[0] ? ' dbt-tab-active' : '';
      return `            <div class="dbt-tab-pane${active}" data-dbt-tab-pane="${doc.key}">${svg}</div>`;
    })
    .join('\n');

  let page = docs[0].html;
  page = page.replace(BOARD_CONTAINER, (_all, open) => `${open}\n${panes}\n        </div>`);
  page = page.replace(/<\/head>/i, `${PAGE_CSS}\n</head>`);
  page = page.replace(/<\/body>/i, `${SWITCHER}\n</body>`);
  return page;
}

/** `dct describe --json` → the board's tab variable: its name, default, order. */
export function tabsOf(description) {
  const variables = Array.isArray(description?.variables) ? description.variables : [];
  const tab = variables.find((variable) => String(variable?.name || '').startsWith('_tab_'));
  if (!tab) throw new Error('board has no `_tab_…` variable — it is not a tabs layout');
  const options = Array.isArray(tab.options) ? tab.options : [];
  if (options.length < 2) throw new Error(`board's tab variable offers ${options.length} option(s), not a tabs layout`);
  const fallback = tab.default && options.includes(tab.default) ? tab.default : options[0];
  return { variable: tab.name, default: fallback, keys: [...options] };
}

/** Nearest ancestor of `boardPath` that holds a `dbt_charts.yml` — dct's own rule. */
export function findProjectDir(boardPath) {
  let dir = dirname(resolve(boardPath));
  for (;;) {
    if (existsSync(join(dir, 'dbt_charts.yml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`no dbt_charts.yml above ${boardPath} — pass --project-dir`);
    }
    dir = parent;
  }
}

/** `dct --version` → the release the binary reports, or null. */
export function dctVersion(output) {
  return /(\d+\.\d+\.\d+)/.exec(String(output || ''))?.[1] ?? null;
}

function renderTab({ dct, board, projectDir, variable, key, out, cwd }) {
  execFileSync(
    dct,
    [
      'render',
      board,
      '--project-dir',
      projectDir,
      '--format',
      'html',
      '--var',
      `${variable}=${key}`,
      '--output',
      out,
    ],
    { cwd, stdio: ['ignore', 'pipe', 'inherit'] },
  );
  return readFileSync(out, 'utf8');
}

function parseArgs(argv) {
  const args = { out: 'public/demos/volta-board/index.html', dct: process.env.DCT_BIN || 'dct' };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!flag.startsWith('--')) throw new Error(`unexpected argument: ${flag}`);
    if (value === undefined) throw new Error(`${flag} needs a value`);
    args[flag.slice(2)] = value;
    i += 1;
  }
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  if (!args.board) {
    console.error(
      'usage: build-volta-board.mjs --board <charts/volta-core.yml> [--project-dir <dir>] ' +
        '[--out <index.html>] [--head-source <index.html>] [--dct <dct>]',
    );
    return 2;
  }

  const board = resolve(args.board);
  const out = resolve(args.out);
  const headSource = resolve(args['head-source'] ?? out);
  const projectDir = args['project-dir'] ? resolve(args['project-dir']) : findProjectDir(board);

  // Read the committed copy first: `--out` and `--head-source` are the same file
  // in the deploy step, and the site-owned tags must survive the overwrite.
  const committed = existsSync(headSource) ? readFileSync(headSource, 'utf8') : null;

  const version = dctVersion(
    execFileSync(args.dct, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
  );
  if (version !== PINNED_DCT_VERSION) {
    console.warn(
      `build-volta-board: ${args.dct} reports dbt-charts ${version ?? '(unknown)'}, the deploy pins ` +
        `${PINNED_DCT_VERSION} — the artifact may differ from what ships`,
    );
  }

  const described = JSON.parse(
    execFileSync(args.dct, ['describe', board, '--project-dir', projectDir, '--json'], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'inherit'],
    }),
  );
  if (described?.success === false) throw new Error(`dct describe failed for ${board}`);
  const tabs = tabsOf(described);

  // The default tab opens first in the merged document; the bar order itself
  // comes from the board SVG and is untouched.
  const order = [tabs.default, ...tabs.keys.filter((key) => key !== tabs.default)];

  const work = mkdtempSync(join(tmpdir(), 'volta-board-'));
  try {
    const pages = order.map((key) => ({
      key,
      html: renderTab({
        dct: args.dct,
        board,
        projectDir,
        variable: tabs.variable,
        key,
        out: join(work, `${key}.html`),
        cwd: projectDir,
      }),
    }));

    let page = mergeTabs(pages);
    if (committed) page = reapplyHead(page, committed);
    writeFileSync(out, page);

    const charts = pages.reduce((total, rendered) => {
      const svg = boardOf(rendered.html, rendered.key).svg;
      return total + (svg.match(/data-chart-id="/g) ?? []).length;
    }, 0);
    console.log(
      `${out}: ${pages.length} tabs (${order.join(', ')}), ${charts} charts, ${(page.length / 1024).toFixed(0)} KB`,
    );
    if (!committed) console.warn(`no committed copy at ${headSource} — the site-owned head was not reapplied`);
    return 0;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(`build-volta-board: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
