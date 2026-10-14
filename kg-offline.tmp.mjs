// Offline check of the new ring-avoiding placement against the REAL graph.json
// (the last good build), so the algorithm can be validated while the Astro build
// is blocked by an unrelated content-schema error.
import { readFileSync } from 'node:fs';
import { placeLabels, labelBox, labelsTooClose } from './src/lib/graph-labels.ts';
import { NODE_SIZE } from './src/lib/graph.ts';

const WORLD = { w: 900, h: 560 };
const FONT = 11;

const isCore = (id) => id.startsWith('core:');
const isAnchor = (id) => isCore(id) || id.startsWith('p:') || id.startsWith('topic:');
const priority = (id) => (id === 'core:me' ? 0 : isCore(id) ? 1 : id.startsWith('p:') ? 2 : 3);
const radius = (s) => (s || 6) * NODE_SIZE;

function measure(file) {
  const g = JSON.parse(readFileSync(file, 'utf8'));
  const nodes = g.nodes;
  const anchors = nodes.filter((n) => isAnchor(n.id));
  const obstacles = nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, r: radius(n.size) }));

  const withRings = placeLabels(
    anchors.map((n) => ({ id: n.id, label: n.label, x: n.x, y: n.y, size: radius(n.size), priority: priority(n.id) })),
    { width: WORLD.w, height: WORLD.h, fontSize: FONT, pad: 4, obstacles: obstacles },
  );
  const noRings = placeLabels(
    anchors.map((n) => ({ id: n.id, label: n.label, x: n.x, y: n.y, size: radius(n.size), priority: priority(n.id) })),
    { width: WORLD.w, height: WORLD.h, fontSize: FONT, pad: 4 },
  );

  const report = (map, tag) => {
    const placed = anchors.filter((n) => map.get(n.id).placed);
    const boxes = placed.map((n) => ({ n, b: labelBox({ ...n, size: radius(n.size) }, map.get(n.id).tx, map.get(n.id).ty, map.get(n.id).anchor, FONT) }));
    let ll = 0;
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++)
        if (labelsTooClose(boxes[i].b, boxes[j].b, 0)) ll++;
    let onNode = 0;
    for (const { n, b } of boxes) {
      for (const o of obstacles) {
        if (o.id === n.id) continue;
        const nx = Math.max(b.x0, Math.min(o.x, b.x1));
        const ny = Math.max(b.y0, Math.min(o.y, b.y1));
        if (Math.hypot(o.x - nx, o.y - ny) < o.r) { onNode++; break; }
      }
    }
    const coresMissing = nodes.filter((n) => isCore(n.id) && !map.get(n.id).placed).map((n) => n.label);
    console.log(`  ${tag.padEnd(14)} placed ${String(placed.length).padStart(2)}/${anchors.length} | ink overlaps ${ll} | labels over node rings ${onNode} | cores unplaced ${JSON.stringify(coresMissing)}`);
  };

  console.log(`\n=== ${file} (${nodes.length} nodes, ${anchors.length} anchors) ===`);
  report(noRings, 'before (no rings)');
  report(withRings, 'after (rings)');
  const gained = anchors.filter((n) => withRings.get(n.id).placed && !noRings.get(n.id).placed).map((n) => n.label);
  const lost = anchors.filter((n) => !withRings.get(n.id).placed && noRings.get(n.id).placed).map((n) => n.label);
  const stillOut = anchors.filter((n) => !withRings.get(n.id).placed).map((n) => n.label);
  console.log('  gained:', JSON.stringify(gained));
  console.log('  lost:  ', JSON.stringify(lost));
  console.log('  still hover-only:', JSON.stringify(stillOut));
}

measure('dist/graph.json');
measure('dist/graph-en.json');
