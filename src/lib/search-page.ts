/**
 * Server-side and client-side logic for `/search/` — the addressable results
 * page. It is deliberately free of `astro:content`: the same module is imported
 * by the page (build time, over `buildSearchIndex()`) and by the page's island
 * (runtime, over the fetched `/search-index.json`), so the two can never
 * disagree about what a filter matches.
 *
 * Ranking is NOT reimplemented here — `runSearch` hands the pool to the existing
 * `rankEntries` / `prepareIndex` from `search-rank.ts`, the same code the header
 * search box uses. This module only adds what the box does not have: filters
 * (`#tag`, `tag:`, `collection:`) and a deterministic date order for the
 * un-queried browse list.
 */
import { withBase } from "./path";
import { prepareIndex, rankEntries, type SearchEntry } from "./search-rank";

export type Locale = "ru" | "en";

export type CollectionType = "topic" | "project" | "part" | "post" | "term" | "source";

/** Display order of the browse sections. Mirrors the index builder's TYPE_ORDER. */
export const COLLECTION_ORDER: CollectionType[] = [
  "topic",
  "project",
  "part",
  "post",
  "term",
  "source",
];

/** URL segment for a collection filter. Plural, because `/search/collection/
 *  projects/` reads as a page of something, not a page about a noun. */
const COLLECTION_SLUGS: Record<CollectionType, string> = {
  topic: "topics",
  project: "projects",
  part: "parts",
  post: "posts",
  term: "terms",
  source: "sources",
};

/** `collection:` accepts the URL slug and the singular type name, plus three
 *  synonyms a reader is likely to type before reading the hint. */
const COLLECTION_ALIASES: Record<string, CollectionType> = {
  topics: "topic",
  topic: "topic",
  projects: "project",
  project: "project",
  parts: "part",
  part: "part",
  posts: "post",
  post: "post",
  terms: "term",
  term: "term",
  sources: "source",
  source: "source",
  library: "source",
};

const LABELS: Record<CollectionType, { section: { ru: string; en: string }; badge: { ru: string; en: string } }> = {
  topic: { section: { ru: "Темы", en: "Topics" }, badge: { ru: "Тема", en: "Topic" } },
  project: { section: { ru: "Проекты", en: "Projects" }, badge: { ru: "Проект", en: "Project" } },
  part: { section: { ru: "Разделы кейса", en: "Case parts" }, badge: { ru: "Кейс", en: "Case" } },
  post: { section: { ru: "Статьи", en: "Posts" }, badge: { ru: "Статья", en: "Post" } },
  term: { section: { ru: "Словарь", en: "Glossary" }, badge: { ru: "Термин", en: "Term" } },
  source: { section: { ru: "Библиотека", en: "Library" }, badge: { ru: "Источник", en: "Source" } },
};

export const collectionSlug = (type: CollectionType): string => COLLECTION_SLUGS[type];

export function collectionFromSlug(slug: string): CollectionType | null {
  return COLLECTION_ALIASES[slug.toLowerCase()] ?? null;
}

/** Section heading of the browse list. */
export const collectionLabel = (type: CollectionType, locale: Locale): string =>
  LABELS[type].section[locale];

/** Per-row type badge on a ranked result. */
export const typeBadge = (type: string, locale: Locale): string =>
  LABELS[type as CollectionType]?.badge[locale] ?? type;

/**
 * Tag → URL/key form. Cyrillic is kept as-is rather than transliterated: the
 * sitemap and the links both use the same function, so the URL stays readable
 * for «статистика» and no two tags can collide through a lossy transliteration.
 * Only `ё` folds, matching `normalize()` in search-rank.
 */
export function tagSlug(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/ё/g, "е")
    .trim()
    .replace(/[^a-zа-я0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Comparison key for a tag slug. Hyphens are ignored, so `#a-b-testing` and
 * `#ab-testing` are one filter: the index carries both spellings ("A/B Testing"
 * and "A/B-тест" slugify differently) and a reader cannot be expected to know
 * which one a given page used.
 */
export const tagKey = (slug: string): string => slug.replace(/-/g, "");

export interface QuerySpec {
  /** Free text, handed to `rankEntries` untouched. */
  terms: string[];
  /** Normalized tag slugs. */
  tags: string[];
  collections: CollectionType[];
}

/**
 * Query syntax, all tokens space-separated and order-independent:
 *
 *   когортный анализ     free terms → ranked through `rankEntries`
 *   #retention           tag filter (URL-encoded as `%23retention`)
 *   tag:retention        the same filter, without the `%23`
 *   collection:projects  type filter; accepts `project`/`projects`,
 *                        `post(s)`, `term(s)`, `part(s)`, `source(s)`,
 *                        `topic(s)`, and `library` for sources
 *
 * An unrecognized `collection:` value is kept as a free term, so a typo returns
 * an honest empty page instead of silently dropping the constraint.
 */
export function parseQuery(raw: string): QuerySpec {
  const spec: QuerySpec = { terms: [], tags: [], collections: [] };
  for (const rawToken of (raw ?? "").trim().split(/\s+/)) {
    const token = rawToken.replace(/^["'«]+|["'»]+$/g, "");
    if (!token) continue;
    const tag = /^#(.+)$/.exec(token) ?? /^tag:(.+)$/i.exec(token);
    if (tag) {
      const slug = tagSlug(tag[1]);
      if (slug && !spec.tags.some((t) => tagKey(t) === tagKey(slug))) spec.tags.push(slug);
      continue;
    }
    const collection = /^(?:collection|type|in):(.+)$/i.exec(token);
    if (collection) {
      const type = COLLECTION_ALIASES[collection[1].toLowerCase()];
      if (type) {
        if (!spec.collections.includes(type)) spec.collections.push(type);
        continue;
      }
    }
    spec.terms.push(token);
  }
  return spec;
}

/**
 * The locale pool. Topics are RU-only pages, so they stay reachable from `/en/`
 * — the same rule `rankEntries` applies internally, repeated here because the
 * un-queried browse list never reaches `rankEntries`.
 */
export function localePool(records: SearchEntry[], locale: Locale): SearchEntry[] {
  return records.filter((r) => r.locale === locale || r.type === "topic");
}

/** Apply the structural filters (`#tag`, `collection:`) to a pool. */
export function filterRecords(records: SearchEntry[], spec: QuerySpec): SearchEntry[] {
  const wantedTags = spec.tags.map(tagKey);
  return records.filter((r) => {
    if (spec.collections.length && !spec.collections.includes(r.type as CollectionType)) {
      return false;
    }
    if (!wantedTags.length) return true;
    return (r.tags ?? []).some((t) => wantedTags.includes(tagKey(tagSlug(t))));
  });
}

/** Dated first (newest first), undated after, ties broken by title. */
export function sortRecords(records: SearchEntry[], locale: Locale = "ru"): SearchEntry[] {
  const ts = (r: SearchEntry) => (r.date ? Date.parse(r.date) || 0 : 0);
  return [...records].sort(
    (a, b) =>
      ts(b) - ts(a) || a.title.localeCompare(b.title, locale) || (a.href < b.href ? -1 : 1),
  );
}

export interface SearchRun {
  spec: QuerySpec;
  /** Size of the filtered pool — what the filters alone matched. */
  total: number;
  items: SearchEntry[];
}

/**
 * One entry point for both surfaces. Free terms rank through `rankEntries`;
 * a filter-only query (the prerendered `/search/tag/<tag>/` pages, or `/search/`
 * with no query at all) is date-ordered instead, because `rankEntries` scores
 * every row at 0 and its per-type cap would then own the order.
 */
export function runSearch(
  records: SearchEntry[],
  raw: string,
  locale: Locale,
  limit: number,
): SearchRun {
  const spec = parseQuery(raw);
  const pool = filterRecords(localePool(records, locale), spec);
  const items = spec.terms.length
    ? rankEntries(prepareIndex(pool), spec.terms, locale, limit)
    : sortRecords(pool, locale).slice(0, limit);
  return { spec, total: pool.length, items };
}

export interface TagFacet {
  /** URL segment, from the most common spelling in the group. */
  slug: string;
  /** Human label — that same spelling, verbatim. */
  label: string;
  count: number;
}

/**
 * Tag filters worth a page. `min` exists so the sitemap does not fill with
 * pages that list one result — a filter page has to earn its URL.
 */
export function tagFacets(records: SearchEntry[], locale: Locale, min = 3): TagFacet[] {
  const groups = new Map<string, { spellings: Map<string, number>; count: number }>();
  for (const r of localePool(records, locale)) {
    // One entry counts once per key, even when it carries two spellings of it.
    const onEntry = new Map<string, string>();
    for (const tag of r.tags ?? []) {
      const slug = tagSlug(tag);
      if (!slug) continue;
      const key = tagKey(slug);
      if (!onEntry.has(key)) onEntry.set(key, tag);
    }
    for (const [key, spelling] of onEntry) {
      const group = groups.get(key) ?? { spellings: new Map<string, number>(), count: 0 };
      group.count += 1;
      group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + 1);
      groups.set(key, group);
    }
  }
  return [...groups.values()]
    .map((group) => {
      const [label] = [...group.spellings.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], locale),
      )[0];
      return { slug: tagSlug(label), label, count: group.count };
    })
    .filter((facet) => facet.slug && facet.count >= min)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, locale));
}

export function filterHref(
  filter: { kind: "tag" | "collection"; value: string },
  locale: Locale,
): string {
  const prefix = locale === "en" ? "en/search" : "search";
  return withBase(`${prefix}/${filter.kind}/${filter.value}/`);
}

/** RU needs three forms; EN needs two. Both are rendered next to a count. */
export function pluralResults(n: number, locale: Locale): string {
  if (locale === "en") return n === 1 ? "result" : "results";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "результат";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "результата";
  return "результатов";
}
