// Shared build-time graph data. Single source of truth for both the SSR
// KnowledgeGraph SVG (rendered at `astro build`) and the /graph.json endpoints,
// so they always agree on nodes, links and positions.
import { getCollection } from "astro:content";
import { buildGraph, mergePostsForLocale, type GraphData } from "./graph";
import { layoutGraph } from "./graph-layout";
import { TOPICS } from "./topics";

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
    return buildGraph({ projects, posts, parts, topics: TOPICS, lang: "en", glossary });
  }
  const [projects, posts, parts, glossary] = await Promise.all([
    getCollection("projects", (p) => !p.data.draft),
    getCollection("posts", (p) => !p.data.draft),
    getCollection("volta-parts", (p) => !p.data.draft),
    getCollection("glossary"),
  ]);
  return buildGraph({ projects, posts, parts, topics: TOPICS, lang: "ru", glossary });
}

/** Both deterministic layouts for the SSR component: the taxonomy-group layout
 *  (default, also what the JSON endpoints serve) and the community layout used
 *  by the client when the toggle switches to community mode. */
export async function getGraphLayouts(
  lang: "ru" | "en",
): Promise<{ group: GraphData; community: GraphData }> {
  const graph = await buildGraphFor(lang);
  return {
    group: layoutGraph(graph),
    community: layoutGraph(graph, { groupBy: "community" }),
  };
}

export async function getGraphData(lang: "ru" | "en"): Promise<GraphData> {
  return (await getGraphLayouts(lang)).group;
}
