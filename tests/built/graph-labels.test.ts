// The graph's labels, against the REAL built SVG.
//
// Why this file exists: `placeLabels` can only be trusted once its output is
// checked against what the build actually drew. Two defects live exactly in
// that gap and are invisible to tests/lib:
//
//  1. A label drawn across its neighbour. `placeLabels` maintains the
//     separation, but its boxes come from `estimateTextWidth` — an estimate 11%
//     short of the rendered width drew `segmentation` on top of `career` on
//     /en/graph/ while every unit test stayed green.
//  2. A core without a label. The root and the type hubs are the graph's
//     anchors; a placement pass that demotes one to hover-only leaves the whole
//     picture unreadable.
//
// Requires `bun run build` first (reads dist/*.html).

import { describe, it, expect, beforeAll } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  labelBox,
  labelsTooClose,
  LABEL_HALO,
  type LabelItem,
  type LabelPlacement,
} from '../../src/lib/graph-labels';

const DIST = resolve(__dirname, '../../dist');
const FONT = 11;

const PAGES = ['graph/index.html', 'en/graph/index.html'] as const;

interface DrawnLabel {
  id: string;
  item: LabelItem;
  cls: string;
  text: string;
  anchor: LabelPlacement['anchor'];
  tx: number;
  ty: number;
}

interface Page {
  labels: DrawnLabel[];
  cores: string[];
  ids: string[];
}

const pages = new Map<string, Page>();

const NUM = String.raw`[-\d.eE+]+`;

/** The built markup is HTML-escaped; the data blob is not. */
const unescapeHtml = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

function parsePage(file: string): Page {
  const html = readFileSync(resolve(DIST, file), 'utf8');
  const data = JSON.parse(html.match(/id="kg-data"[^>]*>([\s\S]*?)<\/script>/)![1]);

  const groupRe = new RegExp(
    String.raw`<g tabindex="0"[^>]*aria-label="([^"]*)"[^>]*transform="translate\((${NUM}),(${NUM})\)"[^>]*>([\s\S]*?)<\/g>`,
    'g',
  );
  const groups = [...html.matchAll(groupRe)];
  if (groups.length !== data.nodes.length) {
    throw new Error(`${file}: ${groups.length} node groups for ${data.nodes.length} nodes`);
  }

  const labels: DrawnLabel[] = [];
  const cores: string[] = [];
  const ids: string[] = [];

  groups.forEach((g, i) => {
    const node = data.nodes[i];
    // The nodes array is serialized in the same order the SVG renders it, so
    // the aria-label must match the node it came from — otherwise every
    // assertion below is about a different node than it claims.
    expect(unescapeHtml(g[1]), `${file}: group order`).toBe(node.label);
    ids.push(node.id);
    if (node.id.startsWith('core:')) cores.push(node.label);

    // `labelRadius(n.size)` — the placement radius, straight off the ring.
    const r = Number(g[4].match(/<circle r="([\d.]+)" class="kg-ring"/)![1]);
    const t = g[4].match(
      new RegExp(
        String.raw`<text x="(${NUM})" y="(${NUM})" text-anchor="(\w+)" class="([^"]*)"[^>]*>([^<]*)<\/text>`,
      ),
    )!;
    labels.push({
      id: node.id,
      item: { id: node.id, label: node.label, x: Number(g[2]), y: Number(g[3]), size: r, priority: 0 },
      tx: Number(t[1]),
      ty: Number(t[2]),
      anchor: t[3] as LabelPlacement['anchor'],
      cls: t[4],
      text: unescapeHtml(t[5]),
    });
  });

  return { labels, cores, ids };
}

beforeAll(() => {
  if (!existsSync(resolve(DIST, 'index.html'))) {
    throw new Error('dist/ missing — run `bun run build` first');
  }
  for (const p of PAGES) {
    if (!existsSync(resolve(DIST, p))) throw new Error(`built page missing: ${p}`);
    pages.set(p, parsePage(p));
  }
});

const isAlwaysOn = (l: DrawnLabel) => !l.cls.includes('kg-label-hover');

describe('graph labels (built SVG)', () => {
  for (const file of PAGES) {
    const page = () => pages.get(file)!;
    const visible = () => page().labels.filter(isAlwaysOn);

    it(`${file}: every core is labelled`, () => {
      // The root plus the type hubs. Demoting one to hover-only is the defect
      // this pins: `--kg-label-halo` and the collision pass cannot be traded
      // for a nameless centre.
      const labelled = new Set(visible().map((l) => l.text));
      for (const core of page().cores) expect(labelled, `${file}: ${core}`).toContain(core);
      expect(page().cores.length).toBeGreaterThanOrEqual(3);
    });

    it(`${file}: no label is drawn across another label`, () => {
      const boxes = visible().map((l) => ({ l, b: labelBox(l.item, l.tx, l.ty, l.anchor, FONT) }));
      const collisions: string[] = [];
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          if (labelsTooClose(boxes[i].b, boxes[j].b, 0)) {
            collisions.push(`${boxes[i].l.text} ‖ ${boxes[j].l.text}`);
          }
        }
      }
      expect(collisions).toEqual([]);
    });

    it(`${file}: every label keeps a full halo clear of its neighbours`, () => {
      // Glyph boxes apart is not enough: each label paints a
      // `stroke-width: LABEL_HALO` background halo, and the later label's halo
      // covers the earlier one's letters at any smaller a gap. This is the
      // "names on top of each other" defect, and it is what the gap is for.
      const boxes = visible().map((l) => ({ l, b: labelBox(l.item, l.tx, l.ty, l.anchor, FONT) }));
      const tooClose: string[] = [];
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          if (labelsTooClose(boxes[i].b, boxes[j].b)) {
            tooClose.push(`${boxes[i].l.text} ‖ ${boxes[j].l.text}`);
          }
        }
      }
      expect(tooClose).toEqual([]);
    });

    it(`${file}: the picture is still labelled, not thinned away`, () => {
      // A regression that widens the estimate (or the gap) far enough to demote
      // most of the graph would otherwise pass every check above.
      expect(visible().length).toBeGreaterThanOrEqual(25);
    });

    it(`${file}: the halo width the placement reserves is the halo the CSS paints`, () => {
      // One number, two languages. The gap `placeLabels` keeps and the CSS
      // `stroke-width` must be the same value, or the reserved space is either
      // wasted (labels needlessly demoted) or short (halo over a neighbour).
      const html = readFileSync(resolve(DIST, file), 'utf8');
      expect(html).toContain(`--kg-label-halo:${LABEL_HALO}px`);
      expect(LABEL_HALO).toBe(5);
    });
  }
});
