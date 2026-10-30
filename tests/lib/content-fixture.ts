// Disk-backed fixture for the directed link index.
//
// `link-index-data.ts` reads collections through `astro:content`, which is not
// importable from a plain bun test. This module is the same read with the same
// filter (`draft:false`) so tests exercise the exact `LinkEntry[]` the build
// would hand `buildLinkIndex` — real frontmatter, real bodies, no Astro.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { buildGlossaryIndex } from "../../src/lib/glossary-linker";
import {
  buildLinkIndex,
  type CollectionName,
  type LinkEntry,
  type LinkIndex,
  type Locale,
} from "../../src/lib/link-index";

export const CONTENT_ROOT = join(__dirname, "..", "..", "src", "content");

/** Mirrors `COLLECTIONS` / `FALLBACK` in `link-index-data.ts`. */
export const COLLECTIONS: Record<Locale, CollectionName[]> = {
  ru: ["projects", "posts", "glossary", "volta-parts", "library"],
  en: ["projects-en", "posts-en", "glossary-en", "volta-parts-en", "library-en"],
};
const FALLBACK: Record<Locale, Locale> = { ru: "en", en: "ru" };

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function readCollection(collection: CollectionName): LinkEntry[] {
  const dir = join(CONTENT_ROOT, collection);
  const entries: LinkEntry[] = [];
  for (const file of readdirSync(dir)) {
    // Same glob as `src/content.config.ts`: `**/[^_]*.{md,mdx}`.
    if (!/\.mdx?$/.test(file) || file.startsWith("_")) continue;
    const raw = readFileSync(join(dir, file), "utf8");
    const match = FRONTMATTER.exec(raw);
    const data = (match ? parseYaml(match[1]) : {}) as {
      title?: string;
      related?: string[];
      children?: string[];
      sources?: string[];
      draft?: boolean;
    };
    if (data.draft) continue;
    entries.push({
      id: file,
      collection,
      title: data.title ?? file.replace(/\.mdx?$/, ""),
      related: data.related,
      children: data.children,
      sources: data.sources,
      body: match ? raw.slice(match[0].length) : raw,
    });
  }
  return entries;
}

/** Own-locale collections plus the other locale as resolution fallback —
 *  exactly what `link-index-data.ts#build` loads. */
export function loadLocaleEntries(locale: Locale): LinkEntry[] {
  return [
    ...COLLECTIONS[locale].flatMap(readCollection),
    ...COLLECTIONS[FALLBACK[locale]].flatMap(readCollection),
  ];
}

export function buildLocaleIndex(locale: Locale): LinkIndex {
  const terms = buildGlossaryIndex();
  return buildLinkIndex({
    locale,
    entries: loadLocaleEntries(locale),
    terms: locale === "en" ? terms.en : terms.ru,
  });
}
