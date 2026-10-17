/**
 * Explorer index — the contract for the app-like surface at `/explorer/`.
 *
 * The site has always known its own relations (graph edges, term backlinks,
 * shared topics) but surfaced them one hop at a time, on one page per entity
 * type. This module is the frozen interface between:
 *
 *   - the build-time endpoint (`src/pages/explorer-index.json.ts`) that
 *     assembles the records, and
 *   - the client island (`src/components/ExplorerApp.astro`) that filters,
 *     sorts and relates them.
 *
 * Same shape as the DSWoK Explorer app's `notes.json` + `tags.json` pair, scaled
 * down to ~250 records: one flat record table, one facet table, relations
 * inline. Nothing here imports `astro:content`, so the module is portable and
 * unit-testable (`tests/lib/explorer.test.ts`).
 */
import { ldWithin } from "./fuzzy";

/* ------------------------------------------------------------------ kinds */

export const EXPLORER_KINDS = [
  "project",
  "post",
  "term",
  "source",
  "volta",
  "topic",
] as const;
export type ExplorerKind = (typeof EXPLORER_KINDS)[number];

/** Kind → chip label, per locale. One copy, so the panel, the list and the
 *  tests cannot drift (same rule as `SOURCE_KINDS`). */
export const KIND_LABELS: Record<ExplorerKind, { ru: string; en: string }> = {
  project: { ru: "Проекты", en: "Projects" },
  post: { ru: "Статьи", en: "Articles" },
  term: { ru: "Глоссарий", en: "Glossary" },
  source: { ru: "Полка", en: "Shelf" },
  volta: { ru: "Volta", en: "Volta" },
  topic: { ru: "Темы", en: "Topics" },
};

/* -------------------------------------------------------------- relations */

/**
 * Relation vocabulary. `related`/`children`/`topic`/`shared` are the graph's
 * own edge types (see `lib/graph.ts`); `backlinks` is the term→content matcher
 * (`lib/glossary.ts#computeBacklinks`) which the graph does not carry.
 */
export const RELATION_TYPES = [
  "related",
  "children",
  "topic",
  "shared",
  "backlinks",
] as const;

/** The two content languages. A record is written in exactly one; the twin is a
 *  separate record, so the locale is a filter dimension, not a field to merge. */
export const EXPLORER_LOCALES = ["ru", "en"] as const;
export type ExplorerLocale = (typeof EXPLORER_LOCALES)[number];

export const LOCALE_LABELS: Record<ExplorerLocale, { ru: string; en: string }> = {
  ru: { ru: "Русский", en: "Russian" },
  en: { ru: "English", en: "English" },
};
export type RelationType = (typeof RELATION_TYPES)[number];

export const RELATION_LABELS: Record<RelationType, { ru: string; en: string }> = {
  related: { ru: "Связанные", en: "Related" },
  children: { ru: "Части", en: "Parts" },
  topic: { ru: "Общая тема", en: "Shares topic" },
  shared: { ru: "Похожие", en: "Similar" },
  backlinks: { ru: "Упоминают термин", en: "Mentions term" },
};

export interface ExplorerRelation {
  type: RelationType;
  /** Target record id — always present in the same locale's record table. */
  id: string;
}

/* ---------------------------------------------------------------- records */

export interface ExplorerRecord {
  /** Stable id, `"<kind-prefix>:<slug>"`, mirroring the graph node ids
   *  (`p:volta`, `post:cohort-retention-guide`, `g:cuped`, `topic:sql`, …) so
   *  the graph and the explorer name the same thing the same way. */
  id: string;
  kind: ExplorerKind;
  locale: "ru" | "en";
  title: string;
  /** Short searchable text: the collection `description`/`excerpt`, or the
   *  first ~240 chars of a shelf note's body. */
  desc: string;
  /** `withBase`-resolved, so every record is a real link. */
  href: string;
  /** Kind-specific bucket: project track, volta layer, post category, term
   *  category, source kind, topic level. `""` when the kind has none. */
  group: string;
  /** Human label for `group`, already resolved in the record's locale. */
  groupLabel: string;
  /** Primary topic key, matched from tags/tools/slug/title (`TOPICS`), or null. */
  topic: string | null;
  tags: string[];
  tools: string[];
  year: number | null;
  /** ISO date — real for posts, `updated` for projects/terms, else null. */
  date: string | null;
  image: string | null;
  relations: ExplorerRelation[];
}

/* ----------------------------------------------------------------- facets */

export const FACET_KEYS = ["locale", "kind", "group", "topic", "tag", "tool", "year"] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

export interface ExplorerFacetValue {
  value: string;
  label: string;
  count: number;
}

export interface ExplorerFacet {
  key: FacetKey;
  label: string;
  values: ExplorerFacetValue[];
}

export const FACET_LABELS: Record<FacetKey, { ru: string; en: string }> = {
  locale: { ru: "Язык", en: "Language" },
  kind: { ru: "Тип", en: "Type" },
  group: { ru: "Раздел", en: "Section" },
  topic: { ru: "Тема", en: "Topic" },
  tag: { ru: "Тег", en: "Tag" },
  tool: { ru: "Инструмент", en: "Tool" },
  year: { ru: "Год", en: "Year" },
};

/** Caps so one long tail cannot drown the panel (mirrors the explorer app's
 *  own caps: tags 60, type 12). Tags/tools keep their head; the tail stays
 *  reachable by typing. */
export const FACET_CAPS: Record<FacetKey, number> = {
  locale: 2,
  kind: 8,
  group: 24,
  topic: 12,
  tag: 24,
  tool: 20,
  year: 12,
};

export interface ExplorerIndex {
  generatedAt: string;
  records: ExplorerRecord[];
  facets: ExplorerFacet[];
  meta: { recordCount: number; relationCount: number };
}

/* ------------------------------------------------------------------ state */

export const EXPLORER_SORT_KEYS = ["relevance", "title", "date", "year", "relations"] as const;
export type ExplorerSortKey = (typeof EXPLORER_SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

export const SORT_LABELS: Record<ExplorerSortKey, { ru: string; en: string }> = {
  relevance: { ru: "По релевантности", en: "Relevance" },
  title: { ru: "По названию", en: "Title" },
  date: { ru: "По дате", en: "Date" },
  year: { ru: "По году", en: "Year" },
  relations: { ru: "По связям", en: "Connections" },
};

/** Natural direction per key, so switching key does not silently invert. */
export const SORT_DIRECTION: Record<ExplorerSortKey, SortDir> = {
  relevance: "desc",
  title: "asc",
  date: "desc",
  year: "desc",
  relations: "desc",
};

export interface ExplorerState {
  q: string;
  locales: ExplorerLocale[];
  kinds: ExplorerKind[];
  groups: string[];
  topics: string[];
  tags: string[];
  tools: string[];
  years: number[];
  sort: ExplorerSortKey;
  dir: SortDir;
}

export const DEFAULT_STATE: ExplorerState = {
  q: "",
  locales: [],
  kinds: [],
  groups: [],
  topics: [],
  tags: [],
  tools: [],
  years: [],
  sort: "relevance",
  dir: "desc",
};

/* ------------------------------------------------------------ text search */

/** NFKD + strip marks + `ё→е` + lowercase + collapse whitespace. Same contract
 *  as the explorer app's `normalize()`, so «ёж» and «еж» match. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ё/g, "е")
    .replace(/Ё/g, "Е")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(query: string): string[] {
  const normalized = normalizeText(query);
  return normalized.length === 0 ? [] : normalized.split(" ");
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Unicode-safe word boundary — `\b` does not fire between `-` and a letter. */
const boundaryMatch = (haystack: string, needle: string): boolean =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(needle)}`, "u").test(haystack);

interface Scorable {
  id: string;
  title: string;
  desc: string;
  tags: string[];
  tools: string[];
  group: string;
  groupLabel: string;
  topic: string | null;
}

/**
 * Score one record against one token. Ranks exact title > title prefix >
 * word-boundary title > substring, then the same ladder over the record's slug,
 * then tags/tools/topic, then the description. Returns 0 when the token does not
 * occur at all — the caller ANDs tokens.
 *
 * The slug ladder matters on a bilingual site: a RU record's title is Russian
 * («Когортный анализ») but its slug is the URL the reader types or remembers
 * (`cohort`), so without it `cohort` finds nothing on the RU side. The DSWoK
 * Explorer scores `id` for the same reason.
 */
function scoreToken(rec: Scorable, token: string): number {
  const title = normalizeText(rec.title);
  const desc = normalizeText(rec.desc);
  const group = normalizeText(rec.groupLabel);
  const topic = rec.topic ? normalizeText(rec.topic) : "";
  const rawSlug = rec.id.slice(rec.id.indexOf(":") + 1);
  const slug = normalizeText(rawSlug);

  if (title === token) return 1000;
  if (title.startsWith(token)) return 420;
  if (boundaryMatch(title, token)) return 260;
  if (title.includes(token)) return 150;

  if (slug === token) return 340;
  if (normalizeText(rawSlug.replace(/-/g, " ")).startsWith(token)) return 240;
  if (boundaryMatch(normalizeText(rawSlug.replace(/-/g, " ")), token)) return 180;
  if (slug.includes(token)) return 110;

  for (const tag of rec.tags) {
    const t = normalizeText(tag);
    if (t === token) return 220;
    if (t.startsWith(token)) return 130;
    if (t.includes(token)) return 70;
  }
  for (const tool of rec.tools) {
    const t = normalizeText(tool);
    if (t === token) return 200;
    if (t.startsWith(token)) return 120;
    if (t.includes(token)) return 60;
  }
  if (topic === token) return 190;
  if (topic.startsWith(token)) return 110;
  if (group === token) return 160;
  if (group.startsWith(token)) return 90;
  if (desc.includes(token)) return 50;
  // Typo recovery — only for tokens long enough to be unambiguous.
  if (token.length >= 5) {
    if (ldWithin(token, title, 2)) return 40;
    for (const tag of rec.tags) if (ldWithin(token, normalizeText(tag), 2)) return 30;
  }
  return 0;
}

/**
 * Score a record against every token. Tokens are ANDed: a record that misses
 * one token scores 0. Relation count gives a small hub boost, so a well-linked
 * project outranks an equally titled orphan (same idea as the explorer's
 * `degree` boost).
 */
export function scoreRecord(rec: ExplorerRecord, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  let total = 0;
  for (const token of tokens) {
    const score = scoreToken(rec, token);
    if (score === 0) return 0;
    total += score;
  }
  return total + Math.min(rec.relations.length, 20) * 0.5;
}

/* --------------------------------------------------------------- matching */

export interface ExplorerFilters {
  q: string;
  locales: ExplorerLocale[];
  kinds: ExplorerKind[];
  groups: string[];
  topics: string[];
  tags: string[];
  tools: string[];
  years: number[];
}

const intersects = <T>(selected: readonly T[], values: readonly T[]): boolean =>
  selected.length === 0 || selected.some((value) => values.includes(value));

/** Single-select facets AND with each other; multi-value within one facet is
 *  OR (picking two tags widens, picking tag + tool narrows). */
export function matchesFilters(rec: ExplorerRecord, filters: ExplorerFilters): boolean {
  if (filters.locales.length > 0 && !filters.locales.includes(rec.locale)) return false;
  if (filters.kinds.length > 0 && !filters.kinds.includes(rec.kind)) return false;
  if (filters.groups.length > 0 && !filters.groups.includes(rec.group)) return false;
  if (filters.topics.length > 0 && !(rec.topic && filters.topics.includes(rec.topic)))
    return false;
  if (!intersects(filters.tags, rec.tags)) return false;
  if (!intersects(filters.tools, rec.tools)) return false;
  if (filters.years.length > 0 && !(rec.year !== null && filters.years.includes(rec.year)))
    return false;
  const tokens = tokenize(filters.q);
  if (tokens.length > 0 && scoreRecord(rec, tokens) === 0) return false;
  return true;
}

function compare(a: ExplorerRecord, b: ExplorerRecord, key: ExplorerSortKey): number {
  switch (key) {
    case "title":
      return a.title.localeCompare(b.title, "ru");
    case "date":
      return (a.date ?? "").localeCompare(b.date ?? "");
    case "year":
      return (a.year ?? 0) - (b.year ?? 0);
    case "relations":
      return a.relations.length - b.relations.length;
    case "relevance":
    default:
      return 0;
  }
}

/**
 * Filter + sort in one pass. `relevance` keeps the caller's scoring order
 * (stable by id), every other key sorts on the record itself. Ties always
 * resolve by id so the same query renders the same list twice.
 */
export function selectRecords(records: readonly ExplorerRecord[], state: ExplorerState): ExplorerRecord[] {
  const tokens = tokenize(state.q);
  const filtered = records.filter((rec) => matchesFilters(rec, state));
  const dir = state.dir === "asc" ? 1 : -1;

  if (state.sort === "relevance" && tokens.length > 0) {
    return filtered
      .map((rec) => ({ rec, score: scoreRecord(rec, tokens) }))
      .sort((x, y) => y.score - x.score || x.rec.id.localeCompare(y.rec.id))
      .map((entry) => entry.rec);
  }

  return filtered.sort(
    (a, b) =>
      dir * compare(a, b, state.sort) ||
      // Default order when the key carries no signal: newest first, then id.
      (b.date ?? "").localeCompare(a.date ?? "") ||
      a.id.localeCompare(b.id),
  );
}

/* ---------------------------------------------------------------- facets */

type FacetPick = (rec: ExplorerRecord) => { value: string; label: string } | null;

const picks: Record<FacetKey, FacetPick> = {
  locale: (rec) => ({ value: rec.locale, label: rec.locale }),
  kind: (rec) => ({ value: rec.kind, label: rec.kind }),
  group: (rec) => (rec.group ? { value: rec.group, label: rec.groupLabel } : null),
  topic: (rec) => (rec.topic ? { value: rec.topic, label: rec.topic } : null),
  tag: (rec) => null, // multi-valued — handled by `countMulti`
  tool: (rec) => null,
  year: (rec) => (rec.year === null ? null : { value: String(rec.year), label: String(rec.year) }),
};

const countMap = (records: readonly ExplorerRecord[], pick: FacetPick): Map<string, ExplorerFacetValue> => {
  const out = new Map<string, ExplorerFacetValue>();
  for (const rec of records) {
    const picked = pick(rec);
    if (!picked) continue;
    const existing = out.get(picked.value);
    if (existing) existing.count += 1;
    else out.set(picked.value, { value: picked.value, label: picked.label, count: 1 });
  }
  return out;
};

const countMulti = (
  records: readonly ExplorerRecord[],
  values: (rec: ExplorerRecord) => readonly string[],
): Map<string, ExplorerFacetValue> => {
  const out = new Map<string, ExplorerFacetValue>();
  for (const rec of records) {
    for (const value of new Set(values(rec))) {
      const existing = out.get(value);
      if (existing) existing.count += 1;
      else out.set(value, { value, label: value, count: 1 });
    }
  }
  return out;
};

const toSortedValues = (
  map: Map<string, ExplorerFacetValue>,
  cap: number,
): ExplorerFacetValue[] =>
  [...map.values()]
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, cap);

/**
 * Build the facet table for the whole record set. Counts are global (not
 * narrowed by the current selection) so the panel never changes shape while
 * the reader is clicking — the same steady-target rule the explorer app uses.
 *
 * `kind`/`group` labels are resolved here so the client renders labels it did
 * not have to know about; labels arrive already localized on the records.
 */
export function buildFacets(records: readonly ExplorerRecord[], lang: "ru" | "en"): ExplorerFacet[] {
  const groupLabels = new Map<string, string>();
  for (const rec of records) if (rec.group) groupLabels.set(rec.group, rec.groupLabel);

  const maps: Record<FacetKey, Map<string, ExplorerFacetValue>> = {
    locale: countMap(records, picks.locale),
    kind: countMap(records, picks.kind),
    group: countMap(records, picks.group),
    topic: countMap(records, picks.topic),
    tag: countMulti(records, (rec) => rec.tags),
    tool: countMulti(records, (rec) => rec.tools),
    year: countMap(records, picks.year),
  };

  // Replace the placeholder labels with localized display names: locale and kind
  // from their closed tables, group from the record's own `groupLabel`.
  for (const value of maps.locale.values())
    value.label = LOCALE_LABELS[value.value as ExplorerLocale][lang];
  for (const value of maps.kind.values()) value.label = KIND_LABELS[value.value as ExplorerKind][lang];
  for (const value of maps.group.values()) value.label = groupLabels.get(value.value) ?? value.value;

  return FACET_KEYS.map((key) => ({
    key,
    label: FACET_LABELS[key][lang],
    values: toSortedValues(maps[key], FACET_CAPS[key]),
  })).filter((facet) => facet.values.length > 0);
}

/* -------------------------------------------------------------- relations */

export interface RelationGroup {
  type: RelationType;
  records: ExplorerRecord[];
}

/**
 * Resolve a record's relations to full records of the same locale, grouped by
 * edge type in `RELATION_TYPES` order and de-duplicated by id (a target can
 * legitimately arrive from two edge types; it shows once, under the first).
 */
export function relationsOf(
  record: ExplorerRecord,
  byId: ReadonlyMap<string, ExplorerRecord>,
): RelationGroup[] {
  const seen = new Set<string>([record.id]);
  const buckets = new Map<RelationType, ExplorerRecord[]>();
  for (const relation of record.relations) {
    const target = byId.get(relation.id);
    if (!target || seen.has(target.id)) continue;
    seen.add(target.id);
    const bucket = buckets.get(relation.type);
    if (bucket) bucket.push(target);
    else buckets.set(relation.type, [target]);
  }
  return RELATION_TYPES.map((type) => ({ type, records: buckets.get(type) ?? [] })).filter(
    (group) => group.records.length > 0,
  );
}

/** Index the record table by id — the shape `relationsOf` wants. */
export function indexById(records: readonly ExplorerRecord[]): Map<string, ExplorerRecord> {
  return new Map(records.map((rec) => [rec.id, rec]));
}

/* ------------------------------------------------------------- URL state */

const readList = <T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
  fallback: readonly T[] = [],
): T[] => {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const raw of params.getAll(key)) {
    for (const part of raw.split(",")) {
      const value = part.trim();
      if (value.length > 0 && allowed.includes(value as T) && !seen.has(value)) {
        seen.add(value);
        out.push(value as T);
      }
    }
  }
  // An absent key means "use the page's default scope", not "no filter" — the
  // two are distinguished by whether the URL carries the key at all.
  return params.has(key) ? out : [...fallback];
};

const readFreeList = (
  params: URLSearchParams,
  key: string,
  fallback: readonly string[] = [],
): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of params.getAll(key)) {
    for (const part of raw.split(",")) {
      const value = part.trim();
      if (value.length > 0 && !seen.has(value)) {
        seen.add(value);
        out.push(value);
      }
    }
  }
  return params.has(key) ? out : [...fallback];
};

/**
 * Parse a query string into explorer state. Defaults are omitted by
 * `buildExplorerQuery`, so reading a missing key restores the default — the
 * pair is the site's one canonical, shareable filter URL.
 */
export function readExplorerState(search: string, defaults: Partial<ExplorerState> = {}): ExplorerState {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const sortParam = params.get("sort");
  const sort =
    sortParam && (EXPLORER_SORT_KEYS as readonly string[]).includes(sortParam)
      ? (sortParam as ExplorerSortKey)
      : defaults.sort ?? DEFAULT_STATE.sort;
  const dirParam = params.get("dir");

  return {
    q: params.get("q")?.trim() ?? defaults.q ?? "",
    locales: readList(params, "lang", EXPLORER_LOCALES, defaults.locales),
    kinds: readList(params, "kind", EXPLORER_KINDS, defaults.kinds),
    groups: readFreeList(params, "group", defaults.groups),
    topics: readFreeList(params, "topic", defaults.topics),
    tags: readFreeList(params, "tag", defaults.tags),
    tools: readFreeList(params, "tool", defaults.tools),
    years: params.has("year")
      ? readFreeList(params, "year")
          .map((value) => Number.parseInt(value, 10))
          .filter((value) => Number.isFinite(value))
      : [...(defaults.years ?? [])],
    sort,
    // An absent `dir` means "the natural direction for this key" — the same
    // rule `buildExplorerQuery` writes by, so the pair round-trips both ways.
    dir: dirParam === "asc" || dirParam === "desc" ? dirParam : SORT_DIRECTION[sort],
  };
}

/** Serialize state, omitting every default so a canonical URL stays short. */
export function buildExplorerQuery(state: ExplorerState): string {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.locales.length) params.set("lang", state.locales.join(","));
  if (state.kinds.length) params.set("kind", state.kinds.join(","));
  if (state.groups.length) params.set("group", state.groups.join(","));
  if (state.topics.length) params.set("topic", state.topics.join(","));
  if (state.tags.length) params.set("tag", state.tags.join(","));
  if (state.tools.length) params.set("tool", state.tools.join(","));
  if (state.years.length) params.set("year", state.years.join(","));
  if (state.sort !== DEFAULT_STATE.sort) params.set("sort", state.sort);
  if (state.dir !== SORT_DIRECTION[state.sort]) params.set("dir", state.dir);
  const query = params.toString();
  return query.length > 0 ? `?${query}` : "";
}

/** Count of active facet selections — the «Сбросить (N)» affordance. */
export function activeFilterCount(state: ExplorerState): number {
  return (
    state.locales.length +
    state.kinds.length +
    state.groups.length +
    state.topics.length +
    state.tags.length +
    state.tools.length +
    state.years.length
  );
}

export function toggleValue<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/* ------------------------------------------------------------- topic match */

export interface TopicLike {
  key: string;
  match: (tag: string) => boolean;
}

export interface TopicSignal {
  slug: string;
  title: string;
  tools: string[];
  desc: string;
  tags: string[];
}

/**
 * Best topic for one entity: a tag match wins (exact taxonomy membership), then
 * the slug/title/tools/description signal match the topic hub already uses
 * (`lib/topics.ts#computeTopicRows`). Returns null when nothing matches, so the
 * topic facet stays honest instead of assigning a default.
 */
export function matchTopic(signal: TopicSignal, topics: readonly TopicLike[]): string | null {
  const tags = signal.tags.map(normalizeText);
  for (const topic of topics) {
    if (tags.some((tag) => topic.match(tag))) return topic.key;
  }
  const slug = normalizeText(signal.slug);
  const title = normalizeText(signal.title);
  const tools = normalizeText(signal.tools.join(" "));
  const desc = normalizeText(signal.desc);
  for (const topic of topics) {
    const needle = normalizeText(topic.key.replace("-", " "));
    if (
      slug.includes(needle) ||
      title.includes(needle) ||
      tools.includes(needle) ||
      desc.includes(needle)
    ) {
      return topic.key;
    }
  }
  return null;
}

/** Graph node id for a kind + slug — one naming rule for graph and explorer. */
export function nodeIdFor(kind: ExplorerKind, slug: string): string {
  const prefix: Record<ExplorerKind, string> = {
    project: "p",
    post: "post",
    term: "g",
    source: "src",
    volta: "vp",
    topic: "topic",
  };
  return `${prefix[kind]}:${slug}`;
}
