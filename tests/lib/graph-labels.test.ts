// Label placement invariants. The graph's always-on labels used to be offset
// purely radially with no collision check, so ring neighbours overlapped and
// edge nodes grew labels clipped by the viewBox. These guard the replacement.
import { describe, it, expect } from "bun:test";
import {
  estimateTextWidth,
  labelBox,
  placeLabels,
  type LabelItem,
  type LabelPlacement,
} from "../../src/lib/graph-labels";

const WORLD = { width: 900, height: 560 };
const FONT = 11;
const OPTS = { ...WORLD, fontSize: FONT, pad: 4 };

/** A ring of nodes — the shape the radial layout actually produces. */
function ring(n: number, radius: number, labelLen = 12): LabelItem[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI;
    return {
      id: `p:node-${i}`,
      label: "x".repeat(labelLen),
      x: WORLD.width / 2 + Math.cos(a) * radius,
      y: WORLD.height / 2 + Math.sin(a) * radius,
      size: 9,
      priority: 2,
    };
  });
}

function boxOf(item: LabelItem, p: LabelPlacement) {
  return labelBox(item, p.tx, p.ty, p.anchor, FONT);
}

const intersects = (a: ReturnType<typeof boxOf>, b: ReturnType<typeof boxOf>) =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

describe("estimateTextWidth", () => {
  it("grows with the string and with the font size", () => {
    expect(estimateTextWidth("A/B-тестирование", FONT)).toBeGreaterThan(
      estimateTextWidth("A/B", FONT),
    );
    expect(estimateTextWidth("Retention", 16)).toBeGreaterThan(
      estimateTextWidth("Retention", 11),
    );
  });

  it("never underestimates the calibrated worst case (CUPED at 11px ≈ 37.9)", () => {
    expect(estimateTextWidth("CUPED", FONT)).toBeGreaterThanOrEqual(37.9);
    expect(estimateTextWidth("ARPU", FONT)).toBeGreaterThanOrEqual(30.4);
    expect(estimateTextWidth("Проекты", FONT)).toBeGreaterThanOrEqual(48.6);
  });
});

describe("placeLabels", () => {
  it("is deterministic: the same input always produces the same placements", () => {
    const items = ring(24, 150);
    const a = placeLabels(items, OPTS);
    const b = placeLabels(items, OPTS);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  it("never overlaps two placed labels", () => {
    const items = ring(24, 150);
    const placed = placeLabels(items, OPTS);
    const boxes = items
      .filter((i) => placed.get(i.id)!.placed)
      .map((i) => boxOf(i, placed.get(i.id)!));
    const collisions: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (intersects(boxes[i], boxes[j])) collisions.push(`${i}‖${j}`);
      }
    }
    expect(collisions).toEqual([]);
  });

  it("keeps a label on a node at the world edge inside the viewBox", () => {
    // One node one pixel from the right edge, nothing else in the world: the
    // only candidates that fit are the inward ones, so this pins the inward
    // candidate being reachable rather than just the box arithmetic.
    const edge: LabelItem = { id: "p:edge", label: "Длинная подпись у края", x: 899, y: 280, size: 9, priority: 2 };
    const placed = placeLabels([edge], OPTS);
    const p = placed.get("p:edge")!;
    expect(p.placed).toBe(true);
    const b = boxOf(edge, p);
    expect(b.x0).toBeGreaterThanOrEqual(OPTS.pad);
    expect(b.x1).toBeLessThanOrEqual(WORLD.width - OPTS.pad);
    expect(b.y0).toBeGreaterThanOrEqual(OPTS.pad);
    expect(b.y1).toBeLessThanOrEqual(WORLD.height - OPTS.pad);
  });

  it("keeps every placed label inside the world, and demotes only a few", () => {
    const items = ring(20, 240);
    const placed = placeLabels(items, OPTS);
    let placedCount = 0;
    for (const item of items) {
      const p = placed.get(item.id)!;
      if (!p.placed) continue;
      placedCount++;
      const b = boxOf(item, p);
      expect(b.x0, item.id).toBeGreaterThanOrEqual(OPTS.pad);
      expect(b.x1, item.id).toBeLessThanOrEqual(WORLD.width - OPTS.pad);
      expect(b.y0, item.id).toBeGreaterThanOrEqual(OPTS.pad);
      expect(b.y1, item.id).toBeLessThanOrEqual(WORLD.height - OPTS.pad);
    }
    // A ring this loose has room for most labels; a silent demotion of every
    // anchor to hover-only (e.g. a `pad` regression) would otherwise pass.
    expect(placedCount).toBeGreaterThanOrEqual(10);
  });

  it("places the root first, so it never loses its slot", () => {
    const items: LabelItem[] = [
      ...ring(40, 60, 20),
      { id: "core:me", label: "Никита Бояркин", x: 450, y: 280, size: 15, priority: 0 },
    ];
    const placed = placeLabels(items, OPTS);
    expect(placed.get("core:me")!.placed).toBe(true);
  });

  it("reports a label with no clear slot as unplaced instead of overlapping one", () => {
    // 40 labels stacked on the exact same point cannot all fit.
    const items = Array.from({ length: 40 }, (_, i) => ({
      id: `p:same-${i}`,
      label: "Подпись достаточной длины",
      x: 450,
      y: 280,
      size: 9,
      priority: 2,
    }));
    const placed = placeLabels(items, OPTS);
    const entries = [...placed.values()];
    expect(entries.length).toBe(40);
    expect(entries.some((p) => !p.placed)).toBe(true);
    // Every unplaced label still carries geometry, so the hover-only render
    // has somewhere to draw.
    for (const p of entries) {
      expect(Number.isFinite(p.tx)).toBe(true);
      expect(Number.isFinite(p.ty)).toBe(true);
    }
  });

  it("gives every item an entry, placed or not", () => {
    const items = ring(10, 120);
    const placed = placeLabels(items, OPTS);
    expect(placed.size).toBe(items.length);
  });
});
