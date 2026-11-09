// Invariants for the conference programme graph, run against the real
// generated data (src/data/talks.json). Same contract as graph-invariants:
// no orphans, every node navigable, every edge weighted and resolvable.
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildTalksGraph,
  overviewGraph,
  talkTitle,
  trackGraph,
  trackSubgraph,
  talksOfTrack,
  UNTRACKED,
  EVENT_ID,
  PROGRAM_URL,
  THEME_WEIGHT,
  MIN_THEME_TALKS,
  MIN_THEME_SHARE,
  MAX_TRACK_THEMES,
  type TalksData,
  type TalksOverlay,
} from "../../src/lib/talks-graph";
import type { GraphData } from "../../src/lib/graph";

const DATA = JSON.parse(readFileSync(join(__dirname, "..", "..", "src", "data", "talks.json"), "utf-8")) as TalksData;
const OVERLAY = JSON.parse(readFileSync(join(__dirname, "..", "..", "src", "data", "talks-en.json"), "utf-8")) as TalksOverlay;
const graph = buildTalksGraph(DATA, "ru");

describe("talks graph", () => {
  it("has every talk plus the event and its tracks", () => {
    expect(graph.nodes.length).toBeGreaterThan(DATA.talks.length);
    expect(graph.nodes.some((n) => n.id === EVENT_ID)).toBe(true);
    for (const talk of DATA.talks) {
      expect(graph.nodes.some((n) => n.id === `talk:${talk.id}`)).toBe(true);
    }
  });

  it("gives every node a url and a known section", () => {
    for (const n of graph.nodes) {
      expect(n.url.length).toBeGreaterThan(0);
      expect(n.url.startsWith("/")).toBe(false);
      expect(["talks", "track"]).toContain(n.section);
    }
  });

  it("weights every edge and points only at existing nodes", () => {
    const ids = new Set(graph.nodes.map((n) => n.id));
    for (const l of graph.links) {
      expect(l.weight).toBeGreaterThan(0);
      expect(l.weight).toBeLessThanOrEqual(1);
      expect(ids.has(l.source)).toBe(true);
      expect(ids.has(l.target)).toBe(true);
      expect(l.source).not.toBe(l.target);
    }
  });

  it("has no duplicate edges and no orphans", () => {
    const keys = new Set(graph.links.map((l) => [l.source, l.target].sort().join("|")));
    expect(keys.size).toBe(graph.links.length);
    const touched = new Set(graph.links.flatMap((l) => [l.source, l.target]));
    expect(graph.nodes.filter((n) => !touched.has(n.id)).map((n) => n.id)).toEqual([]);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(buildTalksGraph(DATA, "ru"))).toBe(JSON.stringify(graph));
  });

  it("buckets the untracked talks instead of dropping them", () => {
    const untracked = talksOfTrack(DATA, UNTRACKED);
    expect(untracked.length).toBe(DATA.talks.filter((t) => !t.trackSlug).length);
    expect(graph.nodes.some((n) => n.id === `track:${UNTRACKED}`)).toBe(true);
  });

  it("builds a track subgraph whose links stay inside it", () => {
    const slug = DATA.tracks.find((t) => talksOfTrack(DATA, t.slug).length > 0)!.slug;
    const sub = trackSubgraph(graph, slug);
    const ids = new Set(sub.nodes.map((n) => n.id));
    expect(ids.has(`track:${slug}`)).toBe(true);
    for (const l of sub.links) {
      expect(ids.has(l.source) && ids.has(l.target)).toBe(true);
    }
    expect(sub.nodes.filter((n) => n.id.startsWith("track:")).length).toBe(1);
  });

  it("translates track names and talk titles through the EN overlay", () => {
    const en = buildTalksGraph(DATA, "en", OVERLAY);
    for (const track of DATA.tracks) {
      const node = en.nodes.find((n) => n.id === `track:${track.slug}`)!;
      expect(node.label).toBe(OVERLAY.tracks![track.name]);
      // The RU graph keeps the programme's own track names.
      expect(graph!.nodes.find((n) => n.id === `track:${track.slug}`)!.label).toBe(track.name);
    }
    for (const talk of DATA.talks) {
      const node = en.nodes.find((n) => n.id === `talk:${talk.id}`)!;
      expect(node.label).toBe(OVERLAY.talkTitles![String(talk.id)]);
      expect(node.label.length).toBeGreaterThan(0);
    }
    // Same anchor contract in both locales, so a link works on either page.
    expect(en.nodes.map((n) => n.id)).toEqual(graph.nodes.map((n) => n.id));
  });

  it("falls back to the RU title when the overlay has no translation", () => {
    const talk = DATA.talks[0];
    expect(talkTitle(talk, "en", { talkTitles: {} })).toBe(talk.title);
    expect(talkTitle(talk, "en", { talkTitles: { [String(talk.id)]: "   " } })).toBe(talk.title);
    expect(talkTitle(talk, "en", undefined)).toBe(talk.title);
    const en = buildTalksGraph(DATA, "en", { tracks: {} });
    expect(en.nodes.find((n) => n.id === `talk:${talk.id}`)!.label).toBe(talk.title);
    expect(en.nodes.find((n) => n.id === `track:${DATA.tracks[0].slug}`)!.label).toBe(
      DATA.tracks[0].name,
    );
  });

  it("counts official tracks apart from the untracked bucket", () => {
    // The page stat reads `data.tracks.length` (11), not the bucket-inclusive
    // group count (12) it used to print.
    expect(DATA.tracks.length).toBe(11);
    const untracked = talksOfTrack(DATA, UNTRACKED).length;
    expect(untracked).toBeGreaterThan(0);
    expect(DATA.tracks.length + (untracked > 0 ? 1 : 0)).toBe(12);
  });
});

// The centre of the graph is the programme itself, so it must leave this site
// for the source programme page. Asserted against a literal, not just against
// the exported constant: a regression that repoints the node at the local
// `talks/` index would keep the two in sync and slip through otherwise.
describe("talks graph — programme root url", () => {
  it("points the event node at the external programme page", () => {
    const root = graph.nodes.find((n) => n.id === EVENT_ID)!;
    expect(root.url).toBe("https://nikitaboyarkin.github.io/mm-program-page/");
    expect(PROGRAM_URL).toBe("https://nikitaboyarkin.github.io/mm-program-page/");
    expect(root.url).toBe(PROGRAM_URL);
    expect(root.url.startsWith("talks/")).toBe(false);
    expect(root.url.startsWith("en/talks/")).toBe(false);
  });
});

// The EN page is the same graph with a locale prefix and translated labels —
// not a separately built site. Every anchor a link carries must survive the
// locale switch unchanged except for the `talks/` → `en/talks/` prefix.
describe("talks graph — EN/RU url parity", () => {
  const enGraph = buildTalksGraph(DATA, "en", OVERLAY);
  const toEnUrl = (ruUrl: string) =>
    ruUrl.startsWith("talks/") ? `en/${ruUrl}` : ruUrl;

  it("keeps the same node ids in both locales", () => {
    expect(enGraph.nodes.map((n) => n.id)).toEqual(graph.nodes.map((n) => n.id));
  });

  it("differs from RU only by the locale prefix", () => {
    const ruById = new Map(graph.nodes.map((n) => [n.id, n]));
    for (const node of enGraph.nodes) {
      const ru = ruById.get(node.id);
      expect(ru).toBeDefined();
      expect(node.url.length).toBeGreaterThan(0);
      expect(node.url.startsWith("undefined")).toBe(false);
      expect(node.url).toBe(toEnUrl(ru!.url));
    }
  });

  it("puts every non-root EN url under en/talks/", () => {
    for (const node of enGraph.nodes) {
      if (node.id === EVENT_ID) continue;
      expect(node.url.startsWith("en/talks/")).toBe(true);
    }
  });
});

// --- Graph shape -------------------------------------------------------------
//
// The regression these guard against is concrete: an earlier build of this
// module carried 11 theme hubs (`topic` edges, 257 of them) plus a talk↔talk
// mesh (`shared`, 343 pairs sharing ≥ 3 themes) on top of the event→track→talk
// star — 703 edges in all. The assertions above still passed on that graph,
// because they only check urls, weights and resolvability. `starViolations` is
// the single predicate that separates the clean star from that hairball; the
// mutation-control block at the bottom feeds it a hand-assembled mutant, so the
// predicate is proven to have teeth without patching a production file.

/** 11 official tracks plus the untracked bucket (27 talks with no track). */
const TRACK_NODES = DATA.tracks.length + (DATA.talks.some((t) => !t.trackSlug) ? 1 : 0);

/** Everything the full graph must NOT contain, reported as a list rather than
 *  thrown one assertion at a time: a wrong graph then shows every way it is
 *  wrong, not just the first. An empty array is the single-level star the
 *  header of `lib/talks-graph.ts` describes. */
function starViolations(g: GraphData): string[] {
  const out: string[] = [];
  const nonCore = [...new Set(g.links.map((l) => l.type))].filter((t) => t !== "core");
  if (nonCore.length) out.push(`edge types other than core: ${nonCore.join(", ")}`);
  const expectedLinks = TRACK_NODES + DATA.talks.length;
  if (g.links.length !== expectedLinks) {
    out.push(`expected ${expectedLinks} edges, got ${g.links.length}`);
  }
  const themeNodes = g.nodes.filter((n) => n.section === "theme");
  if (themeNodes.length) out.push(`${themeNodes.length} theme nodes`);
  const topic = g.links.filter((l) => l.type === "topic");
  if (topic.length) out.push(`${topic.length} topic edges`);
  const shared = g.links.filter((l) => l.type === "shared");
  if (shared.length) out.push(`${shared.length} shared edges`);
  return out;
}

function expectStar(g: GraphData): void {
  const violations = starViolations(g);
  if (violations.length) throw new Error(`not a single-level star:\n${violations.join("\n")}`);
}

describe("talks graph — single-level star", () => {
  it("draws every edge as core and nothing else", () => {
    expect([...new Set(graph.links.map((l) => l.type))]).toEqual(["core"]);
  });

  it("has exactly one edge per track and one per talk", () => {
    expect(TRACK_NODES).toBe(12); // 11 official + the untracked bucket
    expect(DATA.talks.length).toBe(91); // the programme the header numbers describe
    expect(graph.links.length).toBe(12 + 91);
    expect(graph.links.length).toBe(TRACK_NODES + DATA.talks.length);
    expect(starViolations(graph)).toEqual([]);
  });

  it("has no theme nodes", () => {
    expect(graph.nodes.filter((n) => n.section === "theme")).toEqual([]);
    expect(graph.nodes.some((n) => n.id.startsWith("theme:"))).toBe(false);
  });

  it("has no topic or shared edges", () => {
    expect(graph.links.filter((l) => l.type === "topic")).toEqual([]);
    expect(graph.links.filter((l) => l.type === "shared")).toEqual([]);
  });
});

describe("talks graph — overview", () => {
  const overview = overviewGraph(graph);

  it("keeps the event and its tracks and nothing else", () => {
    expect(overview.nodes.length).toBe(1 + TRACK_NODES);
    expect(overview.nodes[0].id).toBe(EVENT_ID);
    expect(overview.nodes.filter((n) => n.section === "track").length).toBe(TRACK_NODES);
    expect(overview.nodes.filter((n) => n.section !== "track" && n.id !== EVENT_ID)).toEqual([]);
    expect(overview.nodes.some((n) => n.id.startsWith("talk:"))).toBe(false);
    expect(overview.nodes.some((n) => n.id.startsWith("theme:"))).toBe(false);
  });

  it("caps every edge weight at 0.5 for spacing", () => {
    expect(overview.links.length).toBe(TRACK_NODES);
    for (const l of overview.links) {
      expect(l.weight).toBeLessThanOrEqual(0.5);
      expect(l.weight).toBeGreaterThan(0);
      expect(l.type).toBe("core");
      expect(l.source).toBe(EVENT_ID);
      expect(l.target.startsWith("track:")).toBe(true);
    }
  });
});

describe("talks graph — track mini-graphs", () => {
  // Three tracks, derived rather than named: the largest tracks that actually
  // produce a theme hub. Naming slugs would rot on the next data sync; deriving
  // them keeps the sample meaningful and the test honest.
  const sampled = DATA.tracks
    .filter((t) => talksOfTrack(DATA, t.slug).length > 0)
    .sort(
      (a, b) =>
        talksOfTrack(DATA, b.slug).length - talksOfTrack(DATA, a.slug).length ||
        a.slug.localeCompare(b.slug),
    )
    .map((track) => ({ track, subgraph: trackGraph(graph, DATA, track.slug, "ru") }))
    .filter(({ subgraph }) => subgraph.nodes.some((n) => n.section === "theme"))
    .slice(0, 3);

  it("samples three tracks that actually carry theme hubs", () => {
    expect(sampled.length).toBe(3);
  });

  for (const { track, subgraph } of sampled) {
    it(`puts the ${track.slug} hub first and keeps all of its talks`, () => {
      const talks = talksOfTrack(DATA, track.slug);
      expect(subgraph.nodes[0].id).toBe(`track:${track.slug}`);
      const ids = new Set(subgraph.nodes.map((n) => n.id));
      for (const talk of talks) expect(ids.has(`talk:${talk.id}`)).toBe(true);
      expect(ids.has(`track:${UNTRACKED}`)).toBe(false);
      // No talk from another track leaks into the mini-graph.
      const own = new Set(talks.map((t) => t.id));
      for (const n of subgraph.nodes) {
        if (n.id.startsWith("talk:")) expect(own.has(Number(n.id.slice("talk:".length)))).toBe(true);
      }
    });

    it(`keeps ${track.slug} to at most ${MAX_TRACK_THEMES} themes above the floor`, () => {
      const talks = talksOfTrack(DATA, track.slug);
      const themeNodes = subgraph.nodes.filter((n) => n.section === "theme");
      expect(themeNodes.length).toBeGreaterThan(0);
      expect(themeNodes.length).toBeLessThanOrEqual(MAX_TRACK_THEMES);
      const floor = Math.max(MIN_THEME_TALKS, Math.ceil(talks.length * MIN_THEME_SHARE));
      for (const node of themeNodes) {
        const themeId = node.id.slice("theme:".length);
        const mentions = talks.filter((t) => t.themes.includes(themeId)).length;
        // A theme is a hub only when the track is actually about it.
        expect(mentions).toBeGreaterThanOrEqual(MIN_THEME_TALKS);
        expect(mentions).toBeGreaterThanOrEqual(floor);
      }
    });

    it(`weights every ${track.slug} theme edge at THEME_WEIGHT`, () => {
      const themeLinks = subgraph.links.filter((l) => l.type === "topic");
      expect(themeLinks.length).toBeGreaterThan(0);
      const themeIds = new Set(
        subgraph.nodes.filter((n) => n.section === "theme").map((n) => n.id),
      );
      for (const l of themeLinks) {
        expect(l.weight).toBe(THEME_WEIGHT);
        expect(themeIds.has(l.source)).toBe(true);
        expect(l.target.startsWith("talk:")).toBe(true);
      }
      // The mini-graph is hub + talks + signature themes; no second mesh layer.
      expect(subgraph.links.filter((l) => l.type === "shared")).toEqual([]);
      for (const l of subgraph.links) expect(["core", "topic"]).toContain(l.type);
    });
  }
});

// Mutation control. An invariant is only worth its lines if it rejects the graph
// it was written for. Rebuild that graph here, by hand, from the same data: the
// clean star plus 11 theme hubs, one `topic` edge per talk×theme mention and one
// `shared` edge per talk pair sharing ≥ 3 themes — the 703-edge hairball the
// header of `lib/talks-graph.ts` describes. No production file is patched; the
// mutant exists only in this test.
const SHARED_THEMES = 3;

function hairball(data: TalksData): GraphData {
  const star = buildTalksGraph(data, "ru");
  const nodes = [...star.nodes];
  const links = [...star.links];

  for (const theme of data.themes) {
    nodes.push({
      id: `theme:${theme.id}`,
      label: theme.label,
      group: "theme",
      section: "theme",
      url: `talks/#theme-${theme.id}`,
      size: 9,
    });
  }

  for (const talk of data.talks) {
    for (const themeId of talk.themes) {
      links.push({
        source: `theme:${themeId}`,
        target: `talk:${talk.id}`,
        weight: THEME_WEIGHT,
        type: "topic",
      });
    }
  }

  for (let i = 0; i < data.talks.length; i++) {
    for (let j = i + 1; j < data.talks.length; j++) {
      const first = new Set(data.talks[i].themes);
      const common = data.talks[j].themes.filter((th) => first.has(th)).length;
      if (common >= SHARED_THEMES) {
        links.push({
          source: `talk:${data.talks[i].id}`,
          target: `talk:${data.talks[j].id}`,
          weight: 0.2,
          type: "shared",
        });
      }
    }
  }

  return { nodes, links };
}

describe("talks graph — mutation control", () => {
  const mutant = hairball(DATA);

  it("the mutant is the 703-edge hairball the header describes", () => {
    expect(mutant.links.filter((l) => l.type === "topic").length).toBe(257);
    expect(mutant.links.filter((l) => l.type === "shared").length).toBe(343);
    expect(mutant.links.length).toBe(703);
    expect(mutant.nodes.length).toBe(1 + TRACK_NODES + DATA.talks.length + DATA.themes.length);
  });

  it("rejects a graph with theme hubs and talk↔talk mesh", () => {
    const violations = starViolations(mutant);
    // All five checks in the predicate fail on the hairball. Pinning the count
    // keeps them live: delete one and this test goes red.
    expect(violations.length).toBe(5);
    const report = violations.join("\n");
    expect(report).toContain("theme nodes");
    expect(report).toContain("topic edges");
    expect(report).toContain("shared edges");
    expect(report).toContain("expected 103 edges, got 703");
    expect(() => expectStar(mutant)).toThrow();
    // The same predicate still passes the real graph, so the failure above is
    // the mutant's shape and not a predicate that always throws.
    expect(starViolations(graph)).toEqual([]);
  });
});
