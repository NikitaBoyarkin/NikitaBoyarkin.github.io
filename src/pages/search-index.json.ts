// Build-time search index. Astro emits this endpoint to /search-index.json in
// static output. The SearchBox island fetches it lazily on first focus and
// filters client-side — no backend, no runtime dependency.
import { getCollection } from "astro:content";
import { withBase } from "../lib/path";
import { TOPICS } from "../lib/topics";
import { translitRu } from "../lib/translit";

interface Entry {
  type: "project" | "part" | "post" | "term" | "source" | "topic";
  locale: "ru" | "en";
  title: string;
  desc: string;
  tags: string[];
  tools: string[];
  href: string;
  date: string | null;
  image: string | null;
  /** Cyrillic folded to Latin, so a query typed on a Latin keyboard
   *  ("vozvratnost") still reaches a Russian entry. */
  translit: string;
  /** Long searchable text — the page substance, not just the blurb. Empty for
   *  collections with no body (topics, glossary terms). */
  body: string;
}

const slugOf = (id: string) => id.replace(/\.md$/, "");

/** Shelf notes carry no `description` — the searchable text is the note itself. */
const shelfText = (entry: { body?: string }): string =>
  (entry.body ?? "").replace(/\s+/g, " ").trim().slice(0, 240);

/** Cap on the searchable body. The whole index must stay under 1 MB at build
 *  time (it is fetched on first focus), so the haystack is bounded. */
const BODY_LIMIT = 600;

/**
 * Markdown control syntax → words. A body sliced raw ships punctuation noise
 * (`##`, `![alt](…)`, backticks), so the cut can land inside a code fence and
 * the words that matter never make it into the haystack. Link text is kept
 * because it is the sentence; the URL is not, because nobody searches for one.
 */
const markdownToText = (md: string): string =>
  md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`([^`]*?)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|~~|__)/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The searchable body of a collection entry, or "" when it has none. */
const bodyOf = (entry: { body?: string }): string => {
  const text = markdownToText(entry.body ?? "");
  // A fixed-offset cut lands mid-word, and that half-word can never be matched.
  // Only trim when the text was actually truncated, or a short body loses its
  // last real word.
  if (text.length <= BODY_LIMIT) return text;
  return text.slice(0, BODY_LIMIT).replace(/\s+\S*$/, "");
};

/** Frozen `translit` shape: title + desc + tags + tools, space-joined. */
const translitOf = (title: string, desc: string, tags: string[], tools: string[]): string =>
  translitRu(`${title} ${desc} ${tags.join(" ")} ${tools.join(" ")}`);

/** Type order is fixed so the payload is build-to-build stable; consumers do
 *  their own sorting — this only removes diff churn. */
const TYPE_ORDER: Entry["type"][] = ["topic", "project", "part", "post", "term", "source"];

export async function GET() {
  const [
    ruProjects,
    enProjects,
    ruParts,
    enParts,
    posts,
    enPosts,
    glossaryTerms,
    glossaryTermsEn,
    shelfRu,
    shelfEn,
  ] = await Promise.all([
    getCollection("projects", (p) => !p.data.draft),
    getCollection("projects-en", (p) => !p.data.draft),
    getCollection("volta-parts", (p) => !p.data.draft),
    getCollection("volta-parts-en", (p) => !p.data.draft),
    getCollection("posts", (p) => !p.data.draft),
    getCollection("posts-en", (p) => !p.data.draft),
    getCollection("glossary", (p) => !p.data.draft),
    getCollection("glossary-en", (p) => !p.data.draft),
    getCollection("library", (p) => !p.data.draft),
    getCollection("library-en", (p) => !p.data.draft),
  ]);

  const entries: Entry[] = [
    // Topic hubs. Ten indexable pages whose whole purpose is to collect content
    // by subject — and search could not find them, so a reader who typed
    // "retention" never saw the page built for exactly that query.
    ...TOPICS.map<Entry>((t) => ({
      type: "topic",
      locale: "ru",
      title: t.label,
      desc: t.blurb,
      // `labelEn` too: topic pages are RU-only, so an English query ("retention
      // / cohorts") is the only way a `/en/` visitor can reach them.
      tags: [...t.tags, t.labelEn],
      tools: [],
      href: withBase(`topics/${t.key}/`),
      date: null,
      image: null,
      translit: translitOf(t.label, t.blurb, [...t.tags, t.labelEn], []),
      // A topic hub has no body of its own — it collects links.
      body: "",
    })),
    ...ruProjects.map<Entry>((p) => ({
      type: "project",
      locale: "ru",
      title: p.data.title,
      desc: p.data.description,
      tags: [],
      tools: p.data.tools ?? [],
      href: withBase(`projects/${slugOf(p.id)}/`),
      date: null,
      image: p.data.hero ? withBase(p.data.hero) : null,
      translit: translitOf(p.data.title, p.data.description, [], p.data.tools ?? []),
      body: bodyOf(p),
    })),
    ...enProjects.map<Entry>((p) => ({
      type: "project",
      locale: "en",
      title: p.data.title,
      desc: p.data.description,
      tags: [],
      tools: p.data.tools ?? [],
      href: withBase(`en/projects/${slugOf(p.id)}/`),
      date: null,
      image: p.data.hero ? withBase(p.data.hero) : null,
      translit: translitOf(p.data.title, p.data.description, [], p.data.tools ?? []),
      body: bodyOf(p),
    })),
    // Volta sub-parts (23 RU + 23 EN). These are full project pages with their
    // own routes, and they are the deepest content on the site; omitting them
    // meant site search could not reach the flagship case's method pages at all.
    // The route param is `part.data.part`, not the file name.
    ...ruParts.map<Entry>((p) => ({
      type: "part",
      locale: "ru",
      title: p.data.title,
      desc: p.data.description,
      tags: [],
      tools: p.data.tools ?? [],
      href: withBase(`projects/volta/${p.data.part}/`),
      date: null,
      image: null,
      translit: translitOf(p.data.title, p.data.description, [], p.data.tools ?? []),
      body: bodyOf(p),
    })),
    ...enParts.map<Entry>((p) => ({
      type: "part",
      locale: "en",
      title: p.data.title,
      desc: p.data.description,
      tags: [],
      tools: p.data.tools ?? [],
      href: withBase(`en/projects/volta/${p.data.part}/`),
      date: null,
      image: null,
      translit: translitOf(p.data.title, p.data.description, [], p.data.tools ?? []),
      body: bodyOf(p),
    })),
    ...posts.map<Entry>((p) => ({
      type: "post",
      locale: "ru",
      title: p.data.title,
      desc: p.data.excerpt,
      tags: p.data.tags ?? [],
      tools: [],
      href: withBase(`posts/${slugOf(p.id)}/`),
      date: p.data.date.toISOString(),
      image: p.data.image ? withBase(p.data.image) : null,
      translit: translitOf(p.data.title, p.data.excerpt, p.data.tags ?? [], []),
      body: bodyOf(p),
    })),
    ...enPosts.map<Entry>((p) => ({
      type: "post",
      locale: "en",
      title: p.data.title,
      desc: p.data.excerpt,
      tags: p.data.tags ?? [],
      tools: [],
      href: withBase(`en/posts/${slugOf(p.id)}/`),
      date: p.data.date.toISOString(),
      image: p.data.image ? withBase(p.data.image) : null,
      translit: translitOf(p.data.title, p.data.excerpt, p.data.tags ?? [], []),
      body: bodyOf(p),
    })),
    // Glossary terms (RU + EN). href is derived from the entry id, matching the
    // `termHref` shape the /glossary/<slug>/ + /en/glossary/<slug>/ routes emit,
    // so every index href resolves to a built page (tests/built/seo.test.ts).
    ...glossaryTerms.map<Entry>((p) => ({
      type: "term",
      locale: "ru",
      title: p.data.title,
      desc: p.data.description,
      tags: p.data.tags ?? [],
      tools: [],
      href: withBase(`glossary/${slugOf(p.id)}/`),
      date: null,
      image: null,
      translit: translitOf(p.data.title, p.data.description, p.data.tags ?? [], []),
      // A term is a definition, and the description already is the definition.
      body: "",
    })),
    ...glossaryTermsEn.map<Entry>((p) => ({
      type: "term",
      locale: "en",
      title: p.data.title,
      desc: p.data.description,
      tags: p.data.tags ?? [],
      tools: [],
      href: withBase(`en/glossary/${slugOf(p.id)}/`),
      date: null,
      image: null,
      translit: translitOf(p.data.title, p.data.description, p.data.tags ?? [], []),
      body: "",
    })),
    // Shelf notes. `desc` is the note body, not a frontmatter field — the shelf
    // schema has no `description`, and the body is the searchable evidence.
    ...shelfRu.map<Entry>((s) => ({
      type: "source",
      locale: "ru",
      title: s.data.title,
      desc: shelfText(s),
      tags: [],
      tools: [],
      href: withBase(`library/${slugOf(s.id)}/`),
      date: null,
      image: null,
      // Shelf entries have no frontmatter text to fold, so the note excerpt is
      // the source of `translit`. `body` is already transliterated as its own
      // haystack — folding it in again only doubled the payload.
      translit: translitRu(`${s.data.title} ${shelfText(s)}`),
      body: bodyOf(s),
    })),
    ...shelfEn.map<Entry>((s) => ({
      type: "source",
      locale: "en",
      title: s.data.title,
      desc: shelfText(s),
      tags: [],
      tools: [],
      href: withBase(`en/library/${slugOf(s.id)}/`),
      date: null,
      image: null,
      translit: translitRu(`${s.data.title} ${shelfText(s)}`),
      body: bodyOf(s),
    })),
  ];

  // Deterministic order: fixed type order, then href. Sorting here (rather than
  // relying on `Promise.all` completion) keeps `/search-index.json` byte-stable
  // between builds, so a content change shows as a content diff only.
  entries.sort((a, b) => {
    const byType = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
    if (byType !== 0) return byType;
    return a.href < b.href ? -1 : a.href > b.href ? 1 : 0;
  });

  return new Response(JSON.stringify(entries), {
    headers: { "content-type": "application/json" },
  });
}
