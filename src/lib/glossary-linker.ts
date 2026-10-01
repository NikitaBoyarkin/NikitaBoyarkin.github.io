/**
 * Glossary term linker — a Sätteri mdast plugin that turns the first mention of
 * a glossary term in a glossary note's body into a link to that term's page.
 *
 * Scope is intentionally narrow: the factory returns `false` for every file
 * whose path is not under `src/content/glossary`, so no existing page can be
 * touched. The term index is read inside the factory (at compile time, per
 * document) rather than at config-eval time, so a newly added note is picked up
 * without restarting Vite.
 *
 * Deliberate simplifications, per the build plan:
 * - At most one link per text node (the plan's "first occurrence" rule is
 *   implemented per node, which also guarantees no double-linking within a
 *   paragraph's runs of text).
 * - A term is never linked on its own page (title or aliases).
 * - Headings and existing links are skipped.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

export interface TermMatcher {
  /** The literal string to look for in prose (a title or an alias). */
  term: string;
  /** Slug of the glossary page the term links to (filename without extension). */
  slug: string;
  /** Abbreviations (`CUPED`, `DAU/MAU`, any all-caps term) match case-sensitively. */
  caseSensitive: boolean;
}

export interface GlossaryIndex {
  ru: TermMatcher[];
  en: TermMatcher[];
}

export interface GlossaryDirs {
  ru: string;
  en: string;
}

// Resolved against this module's own location so the index is found regardless
// of the build's working directory.
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_GLOSSARY_DIRS: GlossaryDirs = {
  ru: path.resolve(HERE, "..", "content", "glossary"),
  en: path.resolve(HERE, "..", "content", "glossary-en"),
};

const GLOSSARY_PATH_MARKER = "/src/content/glossary";
const EN_PATH_MARKER = "glossary-en";

/** All-caps terms (Latin or Cyrillic) are abbreviations and match case-sensitively. */
function isAllCaps(term: string): boolean {
  return /\p{Lu}/u.test(term) && !/\p{Ll}/u.test(term);
}

function readFrontmatter(source: string): Record<string, unknown> | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!match) return null;
  try {
    const parsed = parseYaml(match[1]);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readTermMatchers(dir: string): TermMatcher[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const matchers: TermMatcher[] = [];
  for (const file of entries) {
    if (!file.endsWith(".md") && !file.endsWith(".mdx")) continue;
    if (file.startsWith("_")) continue;
    const slug = file.replace(/\.mdx?$/, "");
    const frontmatter = readFrontmatter(fs.readFileSync(path.join(dir, file), "utf8"));
    if (!frontmatter) continue;

    const terms = new Set<string>();
    const title = frontmatter.title;
    if (typeof title === "string" && title.trim()) terms.add(title.trim());
    const aka = frontmatter.aka;
    if (Array.isArray(aka)) {
      for (const alias of aka) {
        if (typeof alias === "string" && alias.trim()) terms.add(alias.trim());
      }
    }
    for (const term of terms) {
      matchers.push({ term, slug, caseSensitive: isAllCaps(term) });
    }
  }
  return matchers;
}

/**
 * Build the per-locale term indexes from the glossary content directories.
 * Pure (filesystem in, plain objects out) — no Astro imports — so it is
 * directly testable and safe to call from the plugin factory at build time.
 */
export function buildGlossaryIndex(dirs: GlossaryDirs = DEFAULT_GLOSSARY_DIRS): GlossaryIndex {
  return {
    ru: readTermMatchers(path.resolve(dirs.ru)),
    en: readTermMatchers(path.resolve(dirs.en)),
  };
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;

function isWordChar(ch: string): boolean {
  return ch !== "" && WORD_CHAR.test(ch);
}

/**
 * First occurrence of `needle` in `haystack` that is not embedded inside a
 * longer word. `\b` cannot be used: it treats `-` and `/` as boundaries, so a
 * bare `p` would match inside `p-value`. Instead the characters immediately
 * before and after the candidate must not be letters/digits/underscore.
 */
export function findTermOccurrence(haystack: string, needle: string, caseSensitive: boolean): number {
  if (!needle) return -1;
  const source = caseSensitive ? haystack : haystack.toLowerCase();
  const target = caseSensitive ? needle : needle.toLowerCase();
  const length = needle.length;
  let from = 0;
  for (;;) {
    const index = source.indexOf(target, from);
    if (index === -1) return -1;
    const before = index > 0 ? haystack[index - 1] : "";
    const afterIndex = index + length;
    const after = afterIndex < haystack.length ? haystack[afterIndex] : "";
    if (!isWordChar(before) && !isWordChar(after)) return index;
    from = index + 1;
  }
}

export interface GlossaryTextNode {
  type: "text";
  value: string;
}

export interface GlossaryLinkNode {
  type: "link";
  url: string;
  children: GlossaryTextNode[];
}

export type GlossaryReplacement = GlossaryTextNode | GlossaryLinkNode;

/** Structural subset of Sätteri's `MdastVisitorContext` that the plugin uses. */
export interface GlossaryLinkerContext {
  readonly fileURL: URL | undefined;
  parent(node: unknown): { type?: string } | undefined;
  replaceNode(node: unknown, replacement: GlossaryReplacement[]): void;
}

export interface GlossaryLinkerPlugin {
  name: string;
  text?(node: { type: string; value: string }, ctx: GlossaryLinkerContext): void;
}

export interface GlossaryPluginFactoryContext {
  readonly fileURL: URL | undefined;
}

export type GlossaryPluginFactory = (ctx: GlossaryPluginFactoryContext) => GlossaryLinkerPlugin | false;

export interface GlossaryLinkerOptions {
  dirs?: GlossaryDirs;
  /** Pre-built index — lets tests (and callers) skip the filesystem read. */
  index?: GlossaryIndex;
}

/**
 * Factory consumed by Sätteri's `mdastPlugins`. Returns a plugin definition for
 * glossary notes and `false` for everything else, so the plugin is a no-op on
 * the rest of the site.
 */
export function glossaryLinker(options: GlossaryLinkerOptions = {}): GlossaryPluginFactory {
  return (ctx) => {
    const fileURL = ctx.fileURL;
    if (!fileURL) return false;

    let filePath: string;
    try {
      filePath = fileURLToPath(fileURL);
    } catch {
      return false;
    }
    const normalized = filePath.split("\\").join("/");
    if (!normalized.includes(GLOSSARY_PATH_MARKER)) return false;

    const isEn = normalized.includes(EN_PATH_MARKER);
    const fileSlug = path.basename(normalized).replace(/\.mdx?$/, "");
    const basePrefix = isEn ? "/en/glossary" : "/glossary";

    // Read inside the factory (per document) so newly authored notes are seen
    // without a Vite restart.
    const index = options.index ?? buildGlossaryIndex(options.dirs);
    const matchers = isEn ? index.en : index.ru;

    return {
      name: "glossary-linker",
      text(node, context) {
        const parentType = context.parent(node)?.type;
        if (parentType === "heading" || parentType === "link") return;

        const value = node.value;
        if (!value) return;

        // Earliest index wins; ties break toward the longest term (so
        // `DAU/MAU` beats `DAU` at the same position).
        let best: TermMatcher | null = null;
        let bestIndex = -1;
        for (const matcher of matchers) {
          if (matcher.slug === fileSlug) continue;
          const hit = findTermOccurrence(value, matcher.term, matcher.caseSensitive);
          if (hit === -1) continue;
          if (
            best === null ||
            hit < bestIndex ||
            (hit === bestIndex && matcher.term.length > best.term.length)
          ) {
            best = matcher;
            bestIndex = hit;
          }
        }
        if (best === null) return;

        const matchedText = value.slice(bestIndex, bestIndex + best.term.length);
        const replacements: GlossaryReplacement[] = [];
        if (bestIndex > 0) replacements.push({ type: "text", value: value.slice(0, bestIndex) });
        replacements.push({
          type: "link",
          url: `${basePrefix}/${best.slug}/`,
          children: [{ type: "text", value: matchedText }],
        });
        const tail = value.slice(bestIndex + best.term.length);
        if (tail) replacements.push({ type: "text", value: tail });

        context.replaceNode(node, replacements);
      },
    };
  };
}
