// The force kernel: constants, the tick, and the return-phase ease.
//
// Why this file exists: the constants were extracted out of `graph-layout.ts`
// so the client simulation could share them. The golden fixture proves the
// build-time extraction moved no coordinate; these tests cover the parts the
// build-time path never exercises — the home spring, `fixed` pinning, hidden
// nodes and the ease that carries a dragged node back — because those are the
// mechanisms the client depends on and the golden cannot see them.

import { describe, it, expect } from "bun:test";
import {
  CORE_GRAVITY,
  easeTo,
  physicsParams,
  stepSim,
  type PhysicsParams,
  type SimLink,
  type SimNode,
} from '../../src/lib/graph-physics';

const WORLD = { width: 900, height: 560 };

/** Run the tick loop with the real decaying schedule, as both callers do. */
function run(nodes: SimNode[], links: SimLink[], params: PhysicsParams) {
  let alpha = 1;
  let frames = 0;
  for (let f = 0; f < params.maxFrames && alpha >= params.alphaMin; f++) {
    stepSim(nodes, links, { alpha, params, ...WORLD });
    alpha *= 1 - params.alphaDecay;
    frames++;
  }
  return frames;
}

/** Same loop with `alpha` held at 1: the decaying schedule freezes the graph
 *  mid-flight (157 frames), so only a constant alpha lets a damped system reach
 *  its equilibrium — which is the equilibrium under test. */
function settle(nodes: SimNode[], links: SimLink[], params: PhysicsParams, frames = 800) {
  for (let f = 0; f < frames; f++) stepSim(nodes, links, { alpha: 1, params, ...WORLD });
  return nodes;
}

describe('physicsParams', () => {
  it('reproduces the constants the build-time layout used', () => {
    const p = physicsParams(13);
    expect(p.charge).toBe(2200 * Math.sqrt(13));
    expect(p.gravity).toBe(0.004 + 0.001 * Math.sqrt(13));
    expect(p.communityGravity).toBe(p.gravity * 4);
    expect(p.damp).toBe(0.86);
    expect(p.margin).toBe(66.5);
    expect(p.alphaDecay).toBe(0.03 - 0.001 * Math.sqrt(13));
    expect(p.alphaMin).toBe(0.01);
    expect(p.maxFrames).toBe(400);
  });

  it('keeps the maxFrames override, so the layout option still means something', () => {
    expect(physicsParams(13, 7).maxFrames).toBe(7);
    expect(physicsParams(109).maxFrames).toBe(1090);
  });

  it('stays finite for an empty or single-node graph', () => {
    for (const N of [0, 1]) {
      const p = physicsParams(N);
      expect(p.charge).toBeGreaterThan(0);
      expect(p.margin).toBeGreaterThan(0);
      expect(Number.isFinite(p.alphaDecay)).toBe(true);
    }
    // Below ~1000 nodes the margin has not hit its cap yet.
    expect(physicsParams(109).margin).toBe(80);
  });

  it('stops the decaying schedule in a bounded number of frames', () => {
    const p = physicsParams(13);
    const frames = run([{ x: 100, y: 100, vx: 0, vy: 0 }], [], p);
    expect(frames).toBeGreaterThan(0);
    expect(frames).toBeLessThanOrEqual(p.maxFrames);
    // alphaDecay 0.026 → floor(log(0.01)/log(1-0.026)) ≈ 175.
    expect(frames).toBeGreaterThan(100);
  });
});

describe('stepSim', () => {
  it('is deterministic', () => {
    const build = (): SimNode[] => [
      { x: 100, y: 100, vx: 0, vy: 0 },
      { x: 200, y: 300, vx: 0, vy: 0 },
      { x: 700, y: 120, vx: 0, vy: 0, community: 1 },
    ];
    const links: SimLink[] = [
      { source: 0, target: 1, weight: 1 },
      { source: 1, target: 2, weight: 0.4 },
    ];
    const first = build();
    const second = build();
    run(first, links, physicsParams(3));
    run(second, links, physicsParams(3));
    expect(second).toEqual(first);
    // Positions actually moved, so equality is not two frozen arrays.
    expect(first[0].x).not.toBe(100);
  });

  it('holds a pinned node exactly where the cursor is, and still pushes others', () => {
    const nodes: SimNode[] = [
      { x: 100, y: 100, vx: 0, vy: 0 },
      { x: 110, y: 100, vx: 0, vy: 0, fixed: { x: 700, y: 400 } },
    ];
    const free = { x: 100, y: 100, vx: 0, vy: 0 };
    settle(nodes, [], physicsParams(2), 50);
    expect(nodes[1].x).toBe(700);
    expect(nodes[1].y).toBe(400);
    expect(nodes[1].vx).toBe(0);
    expect(nodes[1].vy).toBe(0);
    // The pinned node is a real repulsion source, not an invisible one.
    const alone = settle([free], [], physicsParams(2), 50)[0];
    expect(nodes[0].x).not.toBe(alone.x);
  });

  it('caps a node\'s travel per tick, and only when asked', () => {
    // Two nodes on top of each other: at alpha 1 the 1/d² repulsion has no bound
    // of its own, and one tick hurls them clear across the world. This is the
    // measured 764px/frame that made dragging a core thrash the whole graph.
    const pair = (): SimNode[] => [
      { x: 450, y: 280, vx: 0, vy: 0 },
      { x: 450.001, y: 280, vx: 0, vy: 0 },
    ];
    const params = physicsParams(2);

    const uncapped = pair();
    stepSim(uncapped, [], { alpha: 1, params, ...WORLD });
    expect(Math.abs(uncapped[0].x - 450)).toBeGreaterThan(WORLD.width / 4);

    const capped = pair();
    stepSim(capped, [], { alpha: 1, params, ...WORLD, maxStep: 8 });
    expect(Math.abs(capped[0].x - 450)).toBeLessThanOrEqual(8 + 1e-9);

    // Undefined leaves the tick untouched, so the build-time layout — and its
    // golden fixture — cannot drift from adding the cap.
    const plain = pair();
    const explicitOff = pair();
    stepSim(plain, [], { alpha: 1, params, ...WORLD });
    stepSim(explicitOff, [], { alpha: 1, params, ...WORLD, maxStep: undefined });
    expect(explicitOff).toEqual(plain);
  });

  it('ignores hidden nodes entirely, wherever they are', () => {
    const layout = (bx: number, by: number) => {
      const nodes: SimNode[] = [
        { x: 100, y: 100, vx: 0, vy: 0 },
        { x: bx, y: by, vx: 0, vy: 0, hidden: true },
        { x: 300, y: 300, vx: 0, vy: 0 },
      ];
      // A hidden node is skipped by the link spring too, so the edge is inert.
      settle(nodes, [{ source: 0, target: 2, weight: 1 }], physicsParams(3), 50);
      return nodes;
    };
    const near = layout(110, 100);
    const far = layout(890, 550);
    expect(near[0]).toEqual(far[0]);
    expect(near[2]).toEqual(far[2]);
    // Filtered-out nodes keep the coordinates the caller parked them at.
    expect(near[1]).toEqual({ x: 110, y: 100, vx: 0, vy: 0, hidden: true });
    expect(far[1]).toEqual({ x: 890, y: 550, vx: 0, vy: 0, hidden: true });
  });

  it('clamps a free node inside the world margin', () => {
    const nodes: SimNode[] = [
      { x: 100, y: 100, vx: 0, vy: 0 },
      { x: 890, y: 555, vx: 0, vy: 0 },
    ];
    const p = physicsParams(2);
    settle(nodes, [], p, 5);
    for (const n of nodes) {
      expect(n.x).toBeGreaterThanOrEqual(p.margin);
      expect(n.x).toBeLessThanOrEqual(WORLD.width - p.margin);
      expect(n.y).toBeGreaterThanOrEqual(p.margin);
      expect(n.y).toBeLessThanOrEqual(WORLD.height - p.margin);
    }
  });

  it('rests a core closer to the centre than a plain node given the same two pulls', () => {
    // Both nodes carry the same home, so gravity and the spring have to
    // disagree for the core multiplier to show up in where they come to rest:
    // plain settles at ~486.4, core at ~476.7.
    const p = physicsParams(1);
    const rested = (core: boolean) =>
      settle([{ x: 570, y: 280, vx: 0, vy: 0, home: { x: 490, y: 280 }, core }], [], p)[0];
    const plain = rested(false);
    const core = rested(true);
    const centreDist = (n: SimNode) => Math.hypot(n.x - 450, n.y - 280);
    expect(centreDist(core)).toBeLessThan(centreDist(plain));
    const expectedCore = (450 * p.gravity * CORE_GRAVITY + 490 * p.homeGravity) /
      (p.gravity * CORE_GRAVITY + p.homeGravity);
    expect(core.x).toBeCloseTo(expectedCore, 1);
  });
});

describe('the home spring', () => {
  // One free node, displaced +80 px from a home that is NOT the world centre, so
  // the two pulls disagree and the spring has to win for the node to come back.
  const displaced = (homeGravity: number): SimNode => {
    const params = { ...physicsParams(1), homeGravity };
    const nodes: SimNode[] = [{ x: 570, y: 280, vx: 0, vy: 0, home: { x: 490, y: 280 } }];
    return settle(nodes, [], params)[0];
  };

  it('rests where gravity and the spring balance, not at the world centre', () => {
    const p = physicsParams(1);
    const node = displaced(p.homeGravity);
    // Closed form: (450*gravity + 490*homeGravity) / (gravity + homeGravity).
    const expected = (450 * p.gravity + 490 * p.homeGravity) / (p.gravity + p.homeGravity);
    expect(node.x).toBeCloseTo(expected, 1);
    expect(node.y).toBe(280);
    // 570 → 486.4: most of the 80 px displacement is undone.
    expect(Math.abs(node.x - 490)).toBeLessThan(0.1 * 80);
  });

  it('is the only thing holding the node near home (mutation control)', () => {
    // Drop the spring and the node walks to the world centre instead — 40 px
    // from home — so the assertion above cannot pass without the mechanism.
    const node = displaced(0);
    expect(node.x).toBeCloseTo(450, 1);
    expect(Math.abs(node.x - 490)).toBeGreaterThan(0.4 * 80);
  });

  it('leaves the build-time path untouched when no node has a home', () => {
    // `home` absent → the spring contributes nothing, which is why the golden
    // fixture stayed green through this extraction.
    const withHomeField = { x: 570, y: 280, vx: 0, vy: 0 } as SimNode;
    const p = physicsParams(1);
    const a = settle([{ ...withHomeField }], [], p)[0];
    const b = settle([{ ...withHomeField, home: undefined }], [], p)[0];
    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
  });
});

describe('easeTo (the return phase)', () => {
  const from = [
    { x: 0, y: 0 },
    { x: 100, y: 50 },
  ];
  const home = [
    { x: 10, y: 20 },
    { x: 40, y: 90 },
  ];
  const dist = (a: { x: number; y: number }[], b: { x: number; y: number }[]) =>
    a.reduce((s, p, i) => s + Math.hypot(p.x - b[i].x, p.y - b[i].y), 0);

  it('ends exactly at home, with no float residue', () => {
    const out = easeTo(from, home, 1);
    expect(out).toEqual(home);
    // Not merely close: identical numbers, so the caller can write one frame and
    // land on the coordinates the SSR SVG shipped.
    expect(out[1].x).toBe(home[1].x);
    expect(out[1].y).toBe(home[1].y);
  });

  it('starts exactly at the release positions', () => {
    expect(easeTo(from, home, 0)).toEqual(from);
    expect(easeTo(from, home, -1)).toEqual(from);
  });

  it('moves monotonically toward home', () => {
    const d = [0, 0.25, 0.5, 0.75, 0.9, 1].map((t) => dist(easeTo(from, home, t), home));
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeLessThanOrEqual(d[i - 1]);
    expect(d[0]).toBeGreaterThan(0);
    expect(d[d.length - 1]).toBe(0);
  });

  it('does not overshoot home in the middle of the ease', () => {
    // Smoothstep stays inside [0, 1], so no node passes its target and comes
    // back — an overshoot would read as a bounce at the end of every drag.
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      for (let i = 0; i < from.length; i++) {
        const a = from[i];
        const b = home[i];
        const p = easeTo(from, home, t)[i];
        const span = Math.hypot(b.x - a.x, b.y - a.y);
        expect(Math.hypot(p.x - a.x, p.y - a.y)).toBeLessThanOrEqual(span + 1e-9);
      }
    }
  });

  it('returns fresh objects, so the caller never mutates its own snapshot', () => {
    const out = easeTo(from, home, 0.5);
    out[0].x = 999;
    expect(from[0].x).toBe(0);
  });
});
