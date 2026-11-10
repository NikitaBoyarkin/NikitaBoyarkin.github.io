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
  key: string;
  labels: DrawnLabel[];
  cores: string[];
  ids: string[];
}

/** One rendered `<KnowledgeGraph>` instance. `/graph/` draws three (projects,
 *  glossary, articles) in a row, each with its own payload and SVG; the labels
 *  of one must never be checked against the nodes of another — so each payload
 *  is parsed against only the slice of HTML that belongs to it. */
const pages = new Map<string, Page[]>();

const NUM = String.raw`[-\d.eE+]+`;

/** The built markup is HTML-escaped; the data blob is not. */
const unescapeHtml = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

function parsePage(file: string): Page[] {
  const html = readFileSync(resolve(DIST, file), 'utf8');
  const roots = [...html.matchAll(/<div\b[^>]*data-kg="root"[^>]*>/g)];

  const groupRe = new RegExp(
    String.raw`<g tabindex="0"[^>]*aria-label="([^"]*)"[^>]*transform="translate\((${NUM}),(${NUM})\)"[^>]*>([\s\S]*?)<\/g>`,
    'g',
  );

  return roots.map((rootMatch, idx) => {
    const start = rootMatch.index!;
    const end = idx + 1 < roots.length ? roots[idx + 1].index! : html.length;
    const inst = html.slice(start, end);
    const key = /data-kg-instance="([^"]*)"/.exec(rootMatch[0])?.[1] ?? '';
    const data = JSON.parse(
      /<script[^>]*data-kg="data"[^>]*>([\s\S]*?)<\/script>/.exec(inst)![1],
    );

    const groups = [...inst.matchAll(groupRe)];
    if (groups.length !== data.nodes.length) {
      throw new Error(`${file}:${key}: ${groups.length} node groups for ${data.nodes.length} nodes`);
    }

    const labels: DrawnLabel[] = [];
    const cores: string[] = [];
    const ids: string[] = [];

    groups.forEach((g, i) => {
      const node = data.nodes[i];
      // The nodes array is serialized in the same order the SVG renders it, so
      // the aria-label must match the node it came from — otherwise every
      // assertion below is about a different node than it claims.
      expect(unescapeHtml(g[1]), `${file}:${key}: group order`).toBe(node.label);
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

    return { key, labels, cores, ids };
  });
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
    const instances = () => pages.get(file)!;

    it(`${file}: draws three labelled instances with the expected keys`, () => {
      expect(instances().map((p) => p.key)).toEqual(['projects', 'glossary', 'articles']);
    });

    it(`${file}: every core is labelled`, () => {
      // The type hub of each section graph. Demoting it to hover-only is the
      // defect this pins: `--kg-label-halo` and the collision pass cannot be
      // traded for a nameless centre. The old combined graph had the root plus
      // three hubs always-on; the page still carries all three hubs, now spread
      // one per instance.
      for (const page of instances()) {
        const labelled = new Set(page.labels.filter(isAlwaysOn).map((l) => l.text));
        expect(page.cores.length, `${file}:${page.key}: cores`).toBeGreaterThanOrEqual(1);
        for (const core of page.cores) expect(labelled, `${file}:${page.key}: ${core}`).toContain(core);
      }
      const allCores = instances().flatMap((p) => p.cores);
      expect(allCores.length, `${file}: page-wide cores`).toBeGreaterThanOrEqual(3);
    });

    it(`${file}: no label is drawn across another label`, () => {
      for (const page of instances()) {
        const visible = page.labels.filter(isAlwaysOn);
        const boxes = visible.map((l) => ({ l, b: labelBox(l.item, l.tx, l.ty, l.anchor, FONT) }));
        const collisions: string[] = [];
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            if (labelsTooClose(boxes[i].b, boxes[j].b, 0)) {
              collisions.push(`${boxes[i].l.text} ‖ ${boxes[j].l.text}`);
            }
          }
        }
        expect(collisions, `${file}:${page.key}`).toEqual([]);
      }
    });

    it(`${file}: every label keeps a full halo clear of its neighbours`, () => {
      // Glyph boxes apart is not enough: each label paints a
      // `stroke-width: LABEL_HALO` background halo, and the later label's halo
      // covers the earlier one's letters at any smaller a gap. This is the
      // "names on top of each other" defect, and it is what the gap is for.
      for (const page of instances()) {
        const visible = page.labels.filter(isAlwaysOn);
        const boxes = visible.map((l) => ({ l, b: labelBox(l.item, l.tx, l.ty, l.anchor, FONT) }));
        const tooClose: string[] = [];
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            if (labelsTooClose(boxes[i].b, boxes[j].b)) {
              tooClose.push(`${boxes[i].l.text} ‖ ${boxes[j].l.text}`);
            }
          }
        }
        expect(tooClose, `${file}:${page.key}`).toEqual([]);
      }
    });

    it(`${file}: the picture is still labelled, not thinned away`, () => {
      // A regression that widens the estimate (or the gap) far enough to demote
      // most of the graph would otherwise pass every check above. The floor is
      // page-wide (the board is still one picture in three panels) plus a
      // per-instance floor, because a small section graph legitimately shows
      // few always-on labels while every larger one must clear the old bar.
      const perInstance = instances().map((p) => p.labels.filter(isAlwaysOn).length);
      for (const [i, page] of instances().entries()) {
        // Proportional floor, not `> 0`: a graph that keeps one label per panel
        // would clear "some label survived" while most of its picture went
        // unlabelled. Measured 32/58, 5/32, 10/34 (labels/nodes) — each clears
        // max(3, 10% nodes); a glossary thinned to 1 fails.
        const floor = Math.max(3, Math.ceil(page.ids.length * 0.1));
        expect(perInstance[i], `${file}:${page.key} labels of ${page.ids.length} nodes`).toBeGreaterThanOrEqual(
          floor,
        );
      }
      expect(perInstance.reduce((a, b) => a + b, 0), file).toBeGreaterThanOrEqual(25);
      const biggest = Math.max(...perInstance);
      expect(biggest, `${file}: biggest instance`).toBeGreaterThanOrEqual(25);
    });

    it(`${file}: the halo width the placement reserves is the halo the CSS paints`, () => {
      // One number, two languages. The gap `placeLabels` keeps and the CSS
      // `stroke-width` must be the same value, or the reserved space is either
      // wasted (labels needlessly demoted) or short (halo over a neighbour).
      const doc = readFileSync(resolve(DIST, file), 'utf8');
      expect(doc).toContain(`--kg-label-halo:${LABEL_HALO}px`);
      expect(LABEL_HALO).toBe(5);
    });
  }
});
