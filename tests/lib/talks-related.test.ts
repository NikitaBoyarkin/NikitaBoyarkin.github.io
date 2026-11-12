// Invariants for the Zettelkasten links between talks, run against the real
// generated data (src/data/talks.json). The contract is different from
// talks-graph's: there the graph must stay a star, here the relation is a
// symmetric "see also" and the tests hold it to that.
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  relatedTalks,
  themeIdf,
  RELATED_K,
  RELATED_THRESHOLD,
  type RelatedTalk,
} from "../../src/lib/talks-related";
import type { TalksData } from "../../src/lib/talks-graph";

const DATA = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "src", "data", "talks.json"), "utf-8"),
) as TalksData;
const RELATED = relatedTalks(DATA);
const byId = new Map(DATA.talks.map((talk) => [talk.id, talk]));

/** Every undirected pair, once. */
function pairs(map: Map<number, RelatedTalk[]>): string[] {
  const out = new Set<string>();
  for (const [id, list] of map) {
    for (const rel of list) out.add([id, rel.id].sort((a, b) => a - b).join(":"));
  }
  return [...out];
}

describe("talks related — shape", () => {
  it("gives every talk an entry and links only to existing talks", () => {
    expect(RELATED.size).toBe(DATA.talks.length);
    for (const talk of DATA.talks) expect(RELATED.has(talk.id)).toBe(true);
    for (const list of RELATED.values()) {
      for (const rel of list) {
        expect(byId.has(rel.id)).toBe(true);
        expect(Number.isFinite(rel.score)).toBe(true);
        expect(rel.score).toBeGreaterThan(0);
      }
    }
  });

  it("never links a talk to itself and never repeats a neighbour", () => {
    for (const [id, list] of RELATED) {
      expect(list.some((rel) => rel.id === id)).toBe(false);
      expect(new Set(list.map((rel) => rel.id)).size).toBe(list.length);
    }
  });

  it("ranks by score, then by id, so the order never depends on insertion", () => {
    for (const list of RELATED.values()) {
      for (let i = 1; i < list.length; i++) {
        const prev = list[i - 1];
        const next = list[i];
        expect(prev.score).toBeGreaterThanOrEqual(next.score);
        if (prev.score === next.score) expect(prev.id).toBeLessThan(next.id);
      }
    }
  });

  it("is deterministic", () => {
    const again = relatedTalks(DATA);
    expect(JSON.stringify([...again])).toBe(JSON.stringify([...RELATED]));
  });
});

// The point of symmetrising: a one-way "see also" is a recommendation, a
// two-way link is a backlink. If this breaks, half the lists on the page point
// at a talk that does not point back.
describe("talks related — symmetry", () => {
  it("links both ways: A lists B exactly when B lists A", () => {
    const forward = new Set<string>();
    for (const [id, list] of RELATED) for (const rel of list) forward.add(`${id}:${rel.id}`);
    for (const key of forward) {
      const [a, b] = key.split(":");
      expect(forward.has(`${b}:${a}`)).toBe(true);
    }
  });

  it("keeps the same score in both directions", () => {
    for (const [id, list] of RELATED) {
      for (const rel of list) {
        const back = RELATED.get(rel.id)!.find((other) => other.id === id)!;
        expect(back).toBeDefined();
        expect(back.score).toBe(rel.score);
      }
    }
  });
});

// The relation must be explainable: every pair carries a reason, and a pair that
// rests on structure alone is a same-track pair (the fallback), never a
// scheduling coincidence below the threshold.
describe("talks related — reasons", () => {
  it("explains every pair by a theme or by the track", () => {
    for (const list of RELATED.values()) {
      for (const rel of list) {
        const explained = rel.sharedThemes.length > 0 || rel.sameTrack || rel.sameRoom;
        expect(explained).toBe(true);
      }
    }
  });

  it("only drops below the threshold for the structural fallback", () => {
    for (const list of RELATED.values()) {
      for (const rel of list) {
        if (rel.score >= RELATED_THRESHOLD) continue;
        expect(rel.sameTrack || rel.sameRoom).toBe(true);
      }
    }
  });

  it("orders shared themes rarest first", () => {
    const idf = themeIdf(DATA);
    for (const list of RELATED.values()) {
      for (const rel of list) {
        const weights = rel.sharedThemes.map((theme) => idf.get(theme) ?? 0);
        for (let i = 1; i < weights.length; i++) {
          expect(weights[i - 1]).toBeGreaterThanOrEqual(weights[i]);
        }
      }
    }
  });

  // The regression this guards: `ai` alone (52 of 91 talks) is not a relation.
  // Before the specificity gate, a naive shared-theme count made talk 276 the
  // neighbour of 61 of 91 talks; 271 «Разум вне головы» and 340 «Обфускация
  // персональных данных» were linked on nothing but that tag.
  it("does not link two talks on the widest theme alone", () => {
    const idf = themeIdf(DATA);
    const widest = [...idf.entries()].sort((a, b) => a[1] - b[1])[0][0];
    expect(widest).toBe("ai");
    for (const list of RELATED.values()) {
      for (const rel of list) {
        if (rel.sharedThemes.length !== 1 || rel.sharedThemes[0] !== widest) continue;
        // A tag on 52 of 91 talks is not a relation by itself: the pair has to
        // stand on the track or the room, and the page prints that reason.
        expect(rel.sameTrack || rel.sameRoom).toBe(true);
      }
    }
    expect(RELATED.get(271)!.some((rel) => rel.id === 340)).toBe(false);
    expect(RELATED.get(340)!.some((rel) => rel.id === 271)).toBe(false);
  });

  it("has no hub that swallows the programme", () => {
    // 91 talks, 227 pairs: the most-linked talk may be a genuine hub, but not a
    // third of the programme. The hairball's 276 had 61.
    const inbound = new Map<number, number>();
    for (const list of RELATED.values()) {
      for (const rel of list) inbound.set(rel.id, (inbound.get(rel.id) ?? 0) + 1);
    }
    expect(Math.max(...inbound.values())).toBeLessThan(DATA.talks.length / 4);
  });
});

describe("talks related — coverage", () => {
  it("leaves nobody without a link", () => {
    // An empty "see also" is the one thing this block must not print. The four
    // talks with no themes fall back to their own track or their own room.
    const orphans = [...RELATED].filter(([, list]) => list.length === 0).map(([id]) => id);
    expect(orphans).toEqual([]);
  });

  it("tops up the talks the programme leaves without themes", () => {
    const themeLess = DATA.talks.filter((talk) => (talk.themes ?? []).length === 0);
    expect(themeLess.length).toBe(4);
    for (const talk of themeLess) {
      expect(RELATED.get(talk.id)!.length).toBeGreaterThan(0);
      expect(RELATED.get(talk.id)!.every((rel) => rel.sharedThemes.length === 0)).toBe(true);
      // Three of the four have no track either (they are untracked), so the
      // fallback is their own room — the page labels it that way.
      expect(RELATED.get(talk.id)!.some((rel) => rel.sameTrack || rel.sameRoom)).toBe(true);
    }
  });

  it("stays inside the measured size of the programme", () => {
    // Pinned like the graph's 103 edges: a sync that changes the programme is
    // supposed to make this file red, so the numbers get re-measured by hand.
    expect(DATA.talks.length).toBe(91);
    expect(pairs(RELATED).length).toBe(230);
    const sizes = [...RELATED.values()].map((list) => list.length);
    expect(Math.min(...sizes)).toBe(1);
    expect(Math.max(...sizes)).toBe(12);
    expect(sizes.filter((n) => n >= RELATED_K).length).toBeGreaterThan(DATA.talks.length / 2);
  });

  it("reaches across tracks — it is not a re-listing of the track", () => {
    let cross = 0;
    let total = 0;
    for (const [id, list] of RELATED) {
      for (const rel of list) {
        total++;
        const a = byId.get(id)!;
        const b = byId.get(rel.id)!;
        if (!a.trackSlug || a.trackSlug !== b.trackSlug) cross++;
      }
    }
    expect(total).toBe(460);
    expect(cross / total).toBeGreaterThan(0.4);
  });
});

describe("talks related — k parameter", () => {
  it("narrows the programme when asked for fewer neighbours", () => {
    const two = relatedTalks(DATA, 2);
    expect(pairs(two).length).toBeLessThan(pairs(RELATED).length);
    const forward = new Set<string>();
    for (const [id, list] of two) for (const rel of list) forward.add(`${id}:${rel.id}`);
    for (const key of forward) {
      const [a, b] = key.split(":");
      expect(forward.has(`${b}:${a}`)).toBe(true);
    }
  });
});
