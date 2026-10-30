// Build-time wiring for the directed link index: reads collections, memoizes
// per locale, and applies the site base path so pages receive ready hrefs.
import { getCollection } from "astro:content";
import { withBase } from "./path";
import { buildGlossaryIndex } from "./glossary-linker";
import {
  buildLinkIndex,
  localeOf,
  nodeIdOf,
  slugOf,
  type CollectionName,
  type LinkEntry,
  type LinkIndex,
  type LinkRef,
  type Locale,
  type NodeKind,
} from "./link-index";

const COLLECTIONS: Record<Locale, CollectionName[]> = {
  ru: ["projects", "posts", "glossary", "volta-parts", "library"],
  en: ["projects-en", "posts-en", "glossary-en", "volta-parts-en", "library-en"],
};

// The other locale is loaded too: an EN note that names a RU-only post must
// resolve to that post's page rather than vanish (the documented `related`
// convention). Those nodes never enter the EN orphan set.
const FALLBACK: Record<Locale, Locale> = { ru: "en", en: "ru" };

const cache = new Map<Locale, Promise<LinkIndex>>();

async function loadEntries(collections: CollectionName[]): Promise<LinkEntry[]> {
  const batches = await Promise.all(
    collections.map(async (collection) => {
      const entries = await getCollection(collection as never);
      return (entries as unknown as {
        id: string;
        body?: string;
        data: Partial<LinkEntry> & { draft?: boolean };
      }[])
        .filter((entry) => !entry.data.draft)
        .map((entry) => ({
          id: entry.id,
          collection,
          title: entry.data.title ?? slugOf(entry.id),
          related: entry.data.related,
          children: entry.data.children,
          sources: entry.data.sources,
          body: entry.body,
        }));
    }),
  );
  return batches.flat();
}

async function build(lang: Locale): Promise<LinkIndex> {
  const terms = buildGlossaryIndex();
  const [own, fallback] = await Promise.all([
    loadEntries(COLLECTIONS[lang]),
    loadEntries(COLLECTIONS[FALLBACK[lang]]),
  ]);
  return buildLinkIndex({
    locale: lang,
    entries: [...own, ...fallback],
    terms: lang === "en" ? terms.en : terms.ru,
  });
}

export function getLinkIndex(lang: Locale): Promise<LinkIndex> {
  let pending = cache.get(lang);
  if (!pending) {
    pending = build(lang);
    cache.set(lang, pending);
  }
  return pending;
}

const based = (refs: LinkRef[] | undefined): LinkRef[] =>
  (refs ?? []).map((ref) => ({ ...ref, path: withBase(ref.path) }));

async function refsFor(lang: Locale, kind: NodeKind, slug: string, direction: "in" | "out") {
  const index = await getLinkIndex(lang);
  const id = nodeIdOf(kind, slug, lang);
  return based(direction === "in" ? index.incoming[id] : index.outgoing[id]);
}

/** «Ссылаются сюда» for a post, project or term page. */
export function getBacklinks(lang: Locale, kind: NodeKind, slug: string): Promise<LinkRef[]> {
  return refsFor(lang, kind, slug, "in");
}

/** Authored/derived links leaving a page, for cross-collection navigation. */
export function getOutgoingRefs(lang: Locale, kind: NodeKind, slug: string): Promise<LinkRef[]> {
  return refsFor(lang, kind, slug, "out");
}

export { localeOf };
