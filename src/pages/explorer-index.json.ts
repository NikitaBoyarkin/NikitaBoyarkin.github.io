/**
 * Build-time Explorer index — the data spine of the app-like surface at
 * `/explorer/` (contract: `design-plans/explorer-surface.md` §2, types:
 * `src/lib/explorer.ts`).
 *
 * One flat record table per locale over every content entity, plus the relations
 * the site already knows (graph edges, term backlinks, project→source) and the
 * facet table the panel renders. Nothing here is invented: ids come from
 * `nodeIdFor`, relations from `getGraphData` / `computeBacklinks` / `sources[]`.
 *
 * `buildExplorerIndex` is exported separately from `GET` so other modules (the
 * no-JS static shell) can render from the same assembly instead of a second,
 * drifting copy of it.
 */
import { Buffer } from "node:buffer";
import { getCollection } from "astro:content";
import {
  buildFacets,
  matchTopic,
  nodeIdFor,
  RELATION_TYPES,
  type ExplorerIndex,
  type ExplorerLocale,
  type ExplorerRecord,
  type ExplorerRelation,
  type RelationType,
} from "../lib/explorer";
import { withBase } from "../lib/path";
import { getGraphData } from "../lib/graph-data";
import {
  CATEGORY_LABELS as TERM_CATEGORY_LABELS,
  computeBacklinks,
  type BacklinkSource,
} from "../lib/glossary";
import { LEVEL_LABELS, TOPICS } from "../lib/topics";
import { KIND_LABELS as SOURCE_KIND_LABELS } from "../lib/library";
import { categoryLabel } from "../lib/categories";
import { projectTrackLabels } from "../lib/projects";

/** Contract budget for the serialized payload; `desc` is the only thing
 *  trimmed to honour it (relations are never dropped). */
const JSON_BUDGET_BYTES = 400 * 1024;
const DESC_MAX = 240;
const DESC_MIN = 200;

/**
 * Volta layer → label. Both volta routes carry the same map with identical
 * values (`src/pages/projects/volta/[part].astro:40`,
 * `src/pages/en/projects/volta/[part].astro:37`), so one ru/en copy here cannot
 * drift from them.
 */
const VOLTA_LAYER_LABELS: Record<string, { ru: string; en: string }> = {
  core: { ru: "Core", en: "Core" },
  extended: { ru: "Extended", en: "Extended" },
  "market-jobs": { ru: "Market & Jobs", en: "Market & Jobs" },
  "rat-v2": { ru: "RAT v2", en: "RAT v2" },
  causal: { ru: "Causal", en: "Causal" },
};

/** Graph edge types that survive as explorer relations. `core` edges point at
 *  hub nodes (`core:*`), which are not records, so they are dropped. */
const GRAPH_RELATION: Record<string, RelationType | undefined> = {
  related: "related",
  children: "children",
  topic: "topic",
  shared: "shared",
};

const slugOf = (id: string): string => id.replace(/\.mdx?$/, "");

/** Shelf notes carry no `description` — the note body is the searchable text
 *  (same rule as `src/pages/search-index.json.ts:22`). */
const shelfText = (entry: { body?: string }): string =>
  (entry.body ?? "").replace(/\s+/g, " ").trim();

/** The contract requires a non-empty `desc`; a body-less note falls back to its
 *  title rather than shipping an empty string. */
const descOrTitle = (value: string, title: string): string => {
  const text = value.trim();
  return text.length > 0 ? text : title;
};

const isoOf = (value: Date | undefined): string | null =>
  value instanceof Date && !Number.isNaN(value.valueOf()) ? value.toISOString() : null;

const yearOf = (iso: string | null): number | null => {
  if (iso === null) return null;
  const year = Number.parseInt(iso.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
};

/* ---------------------------------------------------------------- relations */

type RelationStore = Map<string, Map<string, ExplorerRelation>>;

/** De-duplication key — one entry per (type, targetId) pair, per contract. */
const relationKey = (relation: ExplorerRelation): string =>
  `${relation.type}\u0000${relation.id}`;

/**
 * Record one directed edge. Skips self-edges and any target without a record in
 * this locale, which is where cross-locale targets and `core:*` hubs are dropped.
 */
function relate(
  store: RelationStore,
  from: string,
  relation: ExplorerRelation,
  ids: ReadonlySet<string>,
): void {
  if (relation.id === from) return;
  if (!ids.has(relation.id)) return;
  let bucket = store.get(from);
  if (!bucket) {
    bucket = new Map<string, ExplorerRelation>();
    store.set(from, bucket);
  }
  bucket.set(relationKey(relation), relation);
}

/** Deterministic order: `RELATION_TYPES` order, then target id. */
function materialize(store: RelationStore, id: string): ExplorerRelation[] {
  const bucket = store.get(id);
  if (!bucket) return [];
  return [...bucket.values()].sort(
    (a, b) =>
      RELATION_TYPES.indexOf(a.type) - RELATION_TYPES.indexOf(b.type) ||
      a.id.localeCompare(b.id),
  );
}

/* --------------------------------------------------------- locale assembly */

/**
 * Every record of one locale, from that locale's own collections only. EN never
 * falls back to RU: an EN record whose collection is empty stays absent, and a
 * relation target that has no EN record is dropped (not mapped to its RU twin).
 */
async function buildLocale(lang: ExplorerLocale): Promise<ExplorerRecord[]> {
  const en = lang === "en";
  const prefix = en ? "en/" : "";

  const [projects, posts, terms, shelf, parts, graph] = await Promise.all([
    en
      ? getCollection("projects-en", (p) => !p.data.draft)
      : getCollection("projects", (p) => !p.data.draft),
    en
      ? getCollection("posts-en", (p) => !p.data.draft)
      : getCollection("posts", (p) => !p.data.draft),
    en
      ? getCollection("glossary-en", (p) => !p.data.draft)
      : getCollection("glossary", (p) => !p.data.draft),
    en
      ? getCollection("library-en", (p) => !p.data.draft)
      : getCollection("library", (p) => !p.data.draft),
    en
      ? getCollection("volta-parts-en", (p) => !p.data.draft)
      : getCollection("volta-parts", (p) => !p.data.draft),
    getGraphData(lang),
  ]);

  const records: ExplorerRecord[] = [];
  const ids = new Set<string>();
  const push = (record: ExplorerRecord): void => {
    records.push(record);
    ids.add(record.id);
  };

  for (const p of projects) {
    const slug = slugOf(p.id);
    const tools = p.data.tools ?? [];
    const desc = descOrTitle(p.data.description, p.data.title);
    // `updated` is the record's own recency; `date` is the fallback when a
    // project never carried an update stamp.
    const date = isoOf(p.data.updated) ?? isoOf(p.data.date);
    push({
      id: nodeIdFor("project", slug),
      kind: "project",
      locale: lang,
      title: p.data.title,
      desc,
      href: withBase(`${prefix}projects/${slug}/`),
      group: p.data.track,
      groupLabel: projectTrackLabels(lang)[p.data.track] ?? p.data.track,
      topic: matchTopic({ slug, title: p.data.title, tools, desc, tags: [] }, TOPICS),
      tags: [],
      tools,
      year: yearOf(date),
      date,
      image: p.data.hero ? withBase(p.data.hero) : null,
      relations: [],
    });
  }

  for (const p of posts) {
    const slug = slugOf(p.id);
    const tags = p.data.tags ?? [];
    const desc = descOrTitle(p.data.excerpt, p.data.title);
    const date = isoOf(p.data.date);
    push({
      id: nodeIdFor("post", slug),
      kind: "post",
      locale: lang,
      title: p.data.title,
      desc,
      href: withBase(`${prefix}posts/${slug}/`),
      group: p.data.category,
      groupLabel: categoryLabel(p.data.category, lang),
      topic: matchTopic({ slug, title: p.data.title, tools: [], desc, tags }, TOPICS),
      tags,
      tools: [],
      year: yearOf(date),
      date,
      image: p.data.image ? withBase(p.data.image) : null,
      relations: [],
    });
  }

  // Term needles for `computeBacklinks` — collected while the records are built
  // so the two passes cannot disagree about which terms exist.
  const termNeedles: { slug: string; title: string; aka: string[] }[] = [];
  for (const t of terms) {
    const slug = slugOf(t.id);
    const tags = t.data.tags ?? [];
    const desc = descOrTitle(t.data.description, t.data.title);
    const date = isoOf(t.data.updated);
    const category = t.data.category;
    termNeedles.push({ slug, title: t.data.title, aka: t.data.aka ?? [] });
    push({
      id: nodeIdFor("term", slug),
      kind: "term",
      locale: lang,
      title: t.data.title,
      desc,
      href: withBase(`${prefix}glossary/${slug}/`),
      group: category,
      groupLabel: TERM_CATEGORY_LABELS[category][lang],
      topic: matchTopic({ slug, title: t.data.title, tools: [], desc, tags }, TOPICS),
      tags,
      tools: [],
      year: yearOf(date),
      date,
      image: null,
      relations: [],
    });
  }

  for (const part of parts) {
    const slug = slugOf(part.id);
    const tools = part.data.tools ?? [];
    const desc = descOrTitle(part.data.description, part.data.title);
    const layer = part.data.layer;
    push({
      // The id tracks the graph node (`vp:<file slug>`); the href tracks the
      // route param (`data.part`), which the volta route declares as `params.part`
      // (`src/pages/projects/volta/[part].astro:16`). They are the same slug today.
      id: nodeIdFor("volta", slug),
      kind: "volta",
      locale: lang,
      title: part.data.title,
      desc,
      href: withBase(`${prefix}projects/volta/${part.data.part}/`),
      group: layer,
      groupLabel: VOLTA_LAYER_LABELS[layer]?.[lang] ?? layer,
      topic: matchTopic({ slug, title: part.data.title, tools, desc, tags: [] }, TOPICS),
      tags: [],
      tools,
      year: null,
      date: null,
      image: null,
      relations: [],
    });
  }

  for (const s of shelf) {
    const slug = slugOf(s.id);
    const desc = descOrTitle(shelfText(s), s.data.title);
    push({
      id: nodeIdFor("source", slug),
      kind: "source",
      locale: lang,
      title: s.data.title,
      desc,
      href: withBase(`${prefix}library/${slug}/`),
      group: s.data.kind,
      groupLabel: SOURCE_KIND_LABELS[lang][s.data.kind],
      topic: matchTopic({ slug, title: s.data.title, tools: [], desc, tags: [] }, TOPICS),
      tags: [],
      tools: [],
      year: null,
      date: null,
      image: null,
      relations: [],
    });
  }

  for (const topic of TOPICS) {
    // Topics have no EN pages (the route is RU-only, `src/pages/topics/[tag].astro`),
    // so the EN record mirrors the RU topic page exactly as the EN graph does
    // (`src/lib/graph.ts:526`). The `tags` are the topic's canonical spellings, so
    // `matchTopic` resolves every topic record to its own key.
    const title = en ? topic.key : topic.label;
    const tags = [...topic.tags];
    push({
      id: nodeIdFor("topic", topic.key),
      kind: "topic",
      locale: lang,
      title,
      desc: topic.blurb,
      href: withBase(`topics/${topic.key}/`),
      group: topic.level,
      groupLabel: LEVEL_LABELS[topic.level],
      topic: matchTopic(
        { slug: topic.key, title, tools: [], desc: topic.blurb, tags },
        TOPICS,
      ),
      tags,
      tools: [],
      year: null,
      date: null,
      image: null,
      relations: [],
    });
  }

  const store: RelationStore = new Map<string, Map<string, ExplorerRelation>>();

  // (a) Graph edges, both directions. The graph's node ids are already the
  // record ids (`nodeIdFor` uses the same prefixes), so no translation is needed —
  // only the membership test in `relate`.
  for (const link of graph.links) {
    const type = GRAPH_RELATION[link.type];
    if (!type) continue;
    relate(store, link.source, { type, id: link.target }, ids);
    relate(store, link.target, { type, id: link.source }, ids);
  }

  // (b) Term backlinks, reciprocal: the term lists the content that mentions it,
  // and each mentioning content lists the term. Sources are this locale's posts
  // and projects, exactly the set the term pages feed to `computeBacklinks`
  // (`src/pages/glossary/[slug].astro:50`).
  const backlinkSources: BacklinkSource[] = [
    ...posts.map((p): BacklinkSource => ({
      kind: "post",
      slug: slugOf(p.id),
      href: `/${prefix}posts/${slugOf(p.id)}/`,
      title: p.data.title,
      body: p.body ?? "",
    })),
    ...projects.map((p): BacklinkSource => ({
      kind: "project",
      slug: slugOf(p.id),
      href: `/${prefix}projects/${slugOf(p.id)}/`,
      title: p.data.title,
      body: p.body ?? "",
    })),
  ];
  const backlinks = computeBacklinks(termNeedles, backlinkSources);
  for (const [termSlug, mentioning] of Object.entries(backlinks)) {
    const termId = nodeIdFor("term", termSlug);
    for (const source of mentioning) {
      const contentId =
        source.kind === "post"
          ? nodeIdFor("post", source.slug)
          : nodeIdFor("project", source.slug);
      relate(store, termId, { type: "backlinks", id: contentId }, ids);
      relate(store, contentId, { type: "backlinks", id: termId }, ids);
    }
  }

  // (c) Project → shelf source (`sources[]` on the project), a `related` edge
  // both ways. The sources[] list is the only stored side of this relation
  // (`src/content.config.ts:39`), so it cannot be authored twice.
  for (const p of projects) {
    const projectId = nodeIdFor("project", slugOf(p.id));
    for (const sourceSlug of p.data.sources ?? []) {
      const sourceId = nodeIdFor("source", sourceSlug);
      relate(store, projectId, { type: "related", id: sourceId }, ids);
      relate(store, sourceId, { type: "related", id: projectId }, ids);
    }
  }

  return records.map((record) => ({ ...record, relations: materialize(store, record.id) }));
}

/* ------------------------------------------------------------------- output */

const capDesc = (records: ExplorerRecord[], limit: number): ExplorerRecord[] =>
  records.map((record) =>
    record.desc.length > limit ? { ...record, desc: record.desc.slice(0, limit) } : record,
  );

function assemble(records: ExplorerRecord[]): ExplorerIndex {
  return {
    generatedAt: new Date().toISOString(),
    records,
    facets: buildFacets(records, "ru"),
    meta: {
      recordCount: records.length,
      relationCount: records.reduce((total, record) => total + record.relations.length, 0),
    },
  };
}

/**
 * Assemble the whole index. RU records come last on purpose: `buildFacets`
 * labels a `group` value from the last record that carries it
 * (`src/lib/explorer.ts:440`) and group keys are shared across locales
 * (`analytics`, `guide`, a term category…), so RU-last keeps the ru-labelled
 * facet table (`buildFacets(records, 'ru')`) reading in Russian.
 */
export async function buildExplorerIndex(): Promise<ExplorerIndex> {
  const [enRecords, ruRecords] = await Promise.all([buildLocale("en"), buildLocale("ru")]);
  const all = [...enRecords, ...ruRecords];

  let index = assemble(capDesc(all, DESC_MAX));
  if (Buffer.byteLength(JSON.stringify(index), "utf8") > JSON_BUDGET_BYTES) {
    index = assemble(capDesc(all, DESC_MIN));
  }
  return index;
}

export async function GET(): Promise<Response> {
  return new Response(JSON.stringify(await buildExplorerIndex()), {
    headers: { "content-type": "application/json" },
  });
}
