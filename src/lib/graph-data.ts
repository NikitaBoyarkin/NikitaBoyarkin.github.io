// Shared build-time graph data. Single source of truth for both the SSR
// KnowledgeGraph SVG (rendered at `astro build`) and the /graph.json endpoints,
// so they always agree on nodes, links and positions.
import { getCollection } from "astro:content";
import {
  GRAPH_SECTIONS,
  bridgeCounts,
  bridgeTargets,
  buildGraph,
  mergePostsForLocale,
  sectionSubgraph,
  type ExternalHub,
  type GraphData,
  type GraphSection,
} from "./graph";
import { layoutGraph, layoutRadial } from "./graph-layout";
import { TOPICS } from "./topics";
import { EVENT_ID, PROGRAM_URL } from "./talks-graph";
import talks from "../data/talks.json";

/** The conference programme graph is a sibling graph, not content: one hub node
 *  hangs off the project card that reproduces the programme. Its url is the
 *  programme page itself — the same root the talks graph points at — so both
 *  graphs name one source instead of pointing back at each other. */
export function programHub(): ExternalHub {
  return {
    id: EVENT_ID,
    label: talks.event.name,
    url: PROGRAM_URL,
    section: "talks",
    from: "p:mm-program-page",
  };
}

async function buildGraphFor(lang: "ru" | "en"): Promise<GraphData> {
  if (lang === "en") {
    const [projects, postsEn, parts, postsRu, glossary] = await Promise.all([
      getCollection("projects-en", (p) => !p.data.draft),
      getCollection("posts-en", (p) => !p.data.draft),
      getCollection("volta-parts-en", (p) => !p.data.draft),
      getCollection("posts", (p) => !p.data.draft),
      // Glossary terms carry a `draft` flag; fetch unfiltered like the search
      // index so the graph never drifts from the built term pages.
      getCollection("glossary-en"),
    ]);
    const posts = mergePostsForLocale(postsRu, postsEn);
    return buildGraph({
      projects,
      posts,
      parts,
      topics: TOPICS,
      lang: "en",
      glossary,
      externalHubs: [programHub()],
    });
  }
  const [projects, posts, parts, glossary] = await Promise.all([
    getCollection("projects", (p) => !p.data.draft),
    getCollection("posts", (p) => !p.data.draft),
    getCollection("volta-parts", (p) => !p.data.draft),
    getCollection("glossary"),
  ]);
  return buildGraph({
    projects,
    posts,
    parts,
    topics: TOPICS,
    lang: "ru",
    glossary,
    externalHubs: [programHub()],
  });
}

/** Both deterministic layouts for the SSR component: the taxonomy-group layout
 *  (default, also what the JSON endpoints serve) and the community layout used
 *  by the client when the toggle switches to community mode. */
export async function getGraphLayouts(
  lang: "ru" | "en",
): Promise<{ group: GraphData; community: GraphData }> {
  const graph = await buildGraphFor(lang);
  return {
    // The default view is the single-center radial layout, fitted to the
    // KnowledgeGraph's fixed 900x560 world (the component's zoom math depends on
    // that world, so the radial rings are placed inside it, not around it).
    group: layoutRadial(graph, {
      width: 900,
      height: 560,
      minArc: 34,
      ringStep: 48,
      startRadius: 84,
    }),
    // Community mode keeps the force-clustered view: the toggle swaps both the
    // colors and the arrangement, so the emergent clusters stay legible.
    community: layoutGraph(graph, { groupBy: "community" }),
  };
}

export async function getGraphData(lang: "ru" | "en"): Promise<GraphData> {
  return (await getGraphLayouts(lang)).group;
}

export interface SectionGraph {
  key: GraphSection;
  group: GraphData;
  community: GraphData;
  /** nodeId → { destination section: number of edges leaving this graph } */
  bridges: Record<string, Record<string, number>>;
  /** nodeId → { destination section: ids the bridges point at } — the badge's
   *  click target list, so a jump can flash the actual recipients. */
  bridgeIds: Record<string, Record<string, string[]>>;
}

/** The three section graphs `/graph/` renders one under another. Topics ride
 *  along in every section they touch, so the shared vocabulary stays visible
 *  without a fourth canvas. Memoised per locale: the page and the three
 *  component instances all ask for it, and each call would otherwise rebuild
 *  the whole content graph. */
const sectionCache: Partial<Record<"ru" | "en", Promise<SectionGraph[]>>> = {};

export function getGraphSections(lang: "ru" | "en"): Promise<SectionGraph[]> {
  return (sectionCache[lang] ??= buildSectionGraphs(lang));
}

async function buildSectionGraphs(lang: "ru" | "en"): Promise<SectionGraph[]> {
  const graph = await buildGraphFor(lang);
  return GRAPH_SECTIONS.map((key) => {
    const sub = sectionSubgraph(graph, key);
    // The radial layout pins one centre: with the person node gone, the most
    // connected node of the section takes that role, so the picture keeps a
    // readable hub instead of collapsing into one flat ring.
    const degree = new Map<string, number>();
    for (const l of sub.links) {
      degree.set(l.source, (degree.get(l.source) ?? 0) + 1);
      degree.set(l.target, (degree.get(l.target) ?? 0) + 1);
    }
    const rootId = [...degree.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0]?.[0];
    return {
      key,
      group: layoutRadial(sub, {
        width: 900,
        height: 560,
        minArc: 34,
        ringStep: 48,
        startRadius: 84,
        ...(rootId ? { rootId } : {}),
      }),
      community: layoutGraph(sub, { groupBy: "community" }),
      bridges: bridgeCounts(graph, key),
      bridgeIds: bridgeTargets(graph, key),
    };
  });
}
