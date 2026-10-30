/**
 * Directed link index over every content collection.
 *
 * `buildGraph` cannot serve this: it collapses `A→B` and `B→A` into one
 * undirected edge (`graph.ts`, dedupe key) and silently drops unresolved
 * targets. Backlinks need direction and need the danglers kept.
 *
 * Pure module — no `astro:content`, no `import.meta.env` — so tests import it
 * directly, the way `graph.ts` is imported. `link-index-data.ts` is the layer
 * that reads collections and applies the base path.
 */
import { parseRelatedPath } from "./graph";
import { findTermOccurrence, type TermMatcher } from "./glossary-linker";

export type NodeKind = "project" | "post" | "glossary" | "part" | "library";

export type CollectionName =
  | "projects"
  | "projects-en"
  | "posts"
  | "posts-en"
  | "glossary"
  | "glossary-en"
  | "volta-parts"
  | "volta-parts-en"
  | "library"
  | "library-en";

export interface LinkEntry {
  /** Collection entry id, e.g. `ab.md`. */
  id: string;
  collection: CollectionName;
  title: string;
  related?: string[];
  children?: string[];
  sources?: string[];
  body?: string;
}

export type EdgeType = "related" | "children" | "sources" | "wikilink" | "body" | "mention";

/** Lower number wins when the same pair is reachable by several edge types. */
const EDGE_RANK: Record<EdgeType, number> = {
  related: 0,
  children: 1,
  sources: 2,
  wikilink: 3,
  body: 4,
  mention: 5,
};

const PREFIX: Record<NodeKind, string> = {
  project: "p",
  post: "post",
  glossary: "g",
  part: "vp",
  library: "lib",
};

const KIND_OF_COLLECTION: Record<CollectionName, NodeKind> = {
  projects: "project",
  "projects-en": "project",
  posts: "post",
  "posts-en": "post",
  glossary: "glossary",
  "glossary-en": "glossary",
  "volta-parts": "part",
  "volta-parts-en": "part",
  library: "library",
  "library-en": "library",
};

const SEGMENT: Record<NodeKind, string> = {
  project: "projects",
  post: "posts",
  glossary: "glossary",
  part: "projects/volta",
  library: "library",
};

export type Locale = "ru" | "en";

export interface LinkRef {
  /** Node id, e.g. `post:cohort-retention-guide`. */
  id: string;
  title: string;
  /** Site path without the base — `withBase` is applied by the data layer. */
  path: string;
  kind: NodeKind;
  /** Locale of the target note, which is not always the reader's locale. */
  locale: Locale;
  type: EdgeType;
}

export interface UnresolvedLink {
  from: string;
  raw: string;
  reason: "missing" | "ambiguous" | "unparsable";
}

export interface LinkNode {
  id: string;
  title: string;
  path: string;
  kind: NodeKind;
  locale: Locale;
  collection: CollectionName;
}

export interface LinkIndex {
  locale: Locale;
  nodes: Record<string, LinkNode>;
  outgoing: Record<string, LinkRef[]>;
  incoming: Record<string, LinkRef[]>;
  /** Published nodes that nothing points at and that are not collection hubs. */
  orphans: string[];
  /** Authored links that could not be resolved, kept for diagnostics. */
  unresolved: UnresolvedLink[];
}

export interface BuildLinkIndexOptions {
  locale: Locale;
  entries: LinkEntry[];
  /** Glossary matchers of BOTH locales; mentions resolve locale-first. */
  terms?: TermMatcher[];
}

export const slugOf = (id: string): string => id.replace(/\.mdx?$/, "");

export const localeOf = (collection: CollectionName): Locale =>
  collection.endsWith("-en") ? "en" : "ru";

/**
 * Locale is part of the id because the index holds both locales at once: the
 * fallback entries a locale may resolve against are real nodes too. Without it
 * `p:garden` from `projects/` and `p:garden` from `projects-en/` collapse into
 * one node — the fallback entry (appended last) overwrote the own one, so RU
 * pages rendered `/en/…` backlinks and the EN orphan set was empty.
 * RU keeps the bare id; EN is suffixed so existing RU-keyed lookups stay valid.
 */
export const nodeIdOf = (kind: NodeKind, slug: string, locale: Locale = "ru"): string =>
  `${PREFIX[kind]}:${slug}${locale === "en" ? "@en" : ""}`;

export const pathOf = (kind: NodeKind, slug: string, locale: Locale): string =>
  `/${locale === "en" ? "en/" : ""}${SEGMENT[kind]}/${slug}/`;

/** Drop fenced blocks and inline code so links inside samples never count. */
export function stripCode(body: string): string {
  return body.replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]*`/g, " ");
}

const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const MARKDOWN_INTERNAL = /\]\((\/(?:en\/)?(?:projects|posts|glossary)\/[^)\s]+)\)/g;

interface Registry {
  byId: Record<string, LinkNode>;
  byKey: Map<string, LinkNode[]>;
}

function buildRegistry(entries: LinkEntry[]): Registry {
  const byId: Record<string, LinkNode> = {};
  const byKey = new Map<string, LinkNode[]>();
  for (const entry of entries) {
    const kind = KIND_OF_COLLECTION[entry.collection];
    const slug = slugOf(entry.id);
    const locale = localeOf(entry.collection);
    const node: LinkNode = {
      id: nodeIdOf(kind, slug, locale),
      title: entry.title,
      path: pathOf(kind, slug, locale),
      kind,
      locale,
      collection: entry.collection,
    };
    byId[node.id] = node;
    const key = `${kind}:${slug}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(node);
    else byKey.set(key, [node]);
  }
  return { byId, byKey };
}

/** Locale-first lookup, then the other locale — an EN note may name a RU-only
 *  target, which is the site's documented convention for `related`. */
function resolve(
  registry: Registry,
  kind: NodeKind,
  slug: string,
  locale: Locale,
): LinkNode | null {
  const bucket = registry.byKey.get(`${kind}:${slug}`);
  if (!bucket || bucket.length === 0) return null;
  return bucket.find((n) => n.locale === locale) ?? bucket[0];
}

/** Ambiguity is reported, never guessed: a bare `[[slug]]` that names two
 *  different kinds has no correct answer. */
function resolveAnyKind(registry: Registry, slug: string, locale: Locale): LinkNode[] {
  const out: LinkNode[] = [];
  for (const kind of Object.keys(PREFIX) as NodeKind[]) {
    const node = resolve(registry, kind, slug, locale);
    if (node) out.push(node);
  }
  return out;
}

/** `parseRelatedPath` knows projects/posts/glossary only; Volta part pages are
 *  addressed as `/projects/volta/<part>/` and must resolve to the part node. */
const VOLTA_PART_PATH = /^\/(?:en\/)?projects\/volta\/([^/]+)\/?$/;

function parseContentPath(raw: string): { kind: NodeKind; slug: string } | null {
  const part = VOLTA_PART_PATH.exec(raw);
  if (part) return { kind: "part", slug: part[1] };
  const parsed = parseRelatedPath(raw);
  if (!parsed) return null;
  return {
    kind: parsed.type === "project" ? "project" : parsed.type === "post" ? "post" : "glossary",
    slug: parsed.slug,
  };
}

export function buildLinkIndex({ locale, entries, terms = [] }: BuildLinkIndexOptions): LinkIndex {
  const registry = buildRegistry(entries);
  const entriesById = new Map(
    entries.map((e) => [
      nodeIdOf(KIND_OF_COLLECTION[e.collection], slugOf(e.id), localeOf(e.collection)),
      e,
    ]),
  );

  const outgoing: Record<string, LinkRef[]> = {};
  const incoming: Record<string, LinkRef[]> = {};
  const unresolved: UnresolvedLink[] = [];
  const seen = new Set<string>();

  const add = (from: LinkNode, to: LinkNode, type: EdgeType) => {
    if (from.id === to.id) return;
    const key = `${from.id}\u0000${to.id}`;
    const previous = seen.has(key) ? findRef(outgoing[from.id], to.id) : undefined;
    if (previous && EDGE_RANK[previous.type] <= EDGE_RANK[type]) return;
    seen.add(key);
    const ref: LinkRef = {
      id: to.id,
      title: to.title,
      path: to.path,
      kind: to.kind,
      locale: to.locale,
      type,
    };
    const back: LinkRef = {
      id: from.id,
      title: from.title,
      path: from.path,
      kind: from.kind,
      locale: from.locale,
      type,
    };
    outgoing[from.id] = [...(outgoing[from.id] ?? []).filter((r) => r.id !== to.id), ref];
    incoming[to.id] = [...(incoming[to.id] ?? []).filter((r) => r.id !== from.id), back];
  };

  for (const [id, entry] of entriesById) {
    const node = registry.byId[id];
    if (!node) continue;

    for (const raw of entry.related ?? []) {
      const parsed = parseContentPath(raw);
      if (!parsed) {
        if (raw.startsWith("/") || raw.startsWith("[[")) {
          unresolved.push({ from: id, raw, reason: "unparsable" });
        }
        continue;
      }
      const target = resolve(registry, parsed.kind, parsed.slug, node.locale);
      if (target) add(node, target, "related");
      else unresolved.push({ from: id, raw, reason: "missing" });
    }

    for (const slug of entry.children ?? []) {
      const target = resolve(registry, "part", slug, node.locale);
      if (target) add(node, target, "children");
      else unresolved.push({ from: id, raw: `children:${slug}`, reason: "missing" });
    }

    for (const slug of entry.sources ?? []) {
      const target = resolve(registry, "library", slug, node.locale);
      if (target) add(node, target, "sources");
      else unresolved.push({ from: id, raw: `sources:${slug}`, reason: "missing" });
    }

    const body = entry.body ? stripCode(entry.body) : "";
    if (!body) continue;

    for (const match of body.matchAll(WIKILINK)) {
      const slug = match[1].trim();
      const candidates = resolveAnyKind(registry, slug, node.locale);
      if (candidates.length === 1) add(node, candidates[0], "wikilink");
      else unresolved.push({ from: id, raw: `[[${slug}]]`, reason: candidates.length ? "ambiguous" : "missing" });
    }

    for (const match of body.matchAll(MARKDOWN_INTERNAL)) {
      const parsed = parseContentPath(match[1]);
      if (!parsed) {
        unresolved.push({ from: id, raw: match[1], reason: "unparsable" });
        continue;
      }
      const target = resolve(registry, parsed.kind, parsed.slug, node.locale);
      if (target) add(node, target, "body");
      else unresolved.push({ from: id, raw: match[1], reason: "missing" });
    }

    if (terms.length === 0 || node.kind === "glossary") continue;
    const linkedTerms = new Set<string>();
    for (const matcher of terms) {
      if (linkedTerms.has(matcher.slug)) continue;
      if (resolve(registry, "glossary", matcher.slug, node.locale)?.id === node.id) continue;
      if (findTermOccurrence(body, matcher.term, matcher.caseSensitive) === -1) continue;
      const target = resolve(registry, "glossary", matcher.slug, node.locale);
      if (!target) continue;
      linkedTerms.add(matcher.slug);
      add(node, target, "mention");
    }
  }

  // Fallback entries from the other locale live in the registry so lookups can
  // resolve them, but they are not this locale's published set.
  const orphans = Object.keys(registry.byId).filter(
    (id) => registry.byId[id].locale === locale && (incoming[id] ?? []).length === 0,
  );

  return { locale, nodes: registry.byId, outgoing, incoming, unresolved, orphans };
}

function findRef(refs: LinkRef[] | undefined, id: string): LinkRef | undefined {
  return refs?.find((r) => r.id === id);
}

/** `A→B` counts as reciprocal only when `B→A` also exists. */
export function pairStats(index: LinkIndex): { pairs: number; reciprocal: number } {
  let pairs = 0;
  let reciprocal = 0;
  for (const [from, refs] of Object.entries(index.outgoing)) {
    for (const ref of refs) {
      pairs += 1;
      if (findRef(index.outgoing[ref.id], from)) reciprocal += 1;
    }
  }
  return { pairs, reciprocal };
}
