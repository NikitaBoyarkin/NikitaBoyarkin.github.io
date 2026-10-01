// Glossary (Словарь) — pure helpers shared by the term routes, the knowledge
// graph and the bun test suite. Deliberately free of `astro:content` imports so
// it can be imported by tests; disk loading uses `node:fs` + the `yaml` parser.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

export type GlossaryLang = 'ru' | 'en';
export type GlossaryCategory = 'statistics' | 'experiment' | 'product' | 'data' | 'business';

export interface GlossaryTerm {
  slug: string;
  lang: GlossaryLang;
  title: string;
  description: string;
  aka: string[];
  category: GlossaryCategory;
  tags: string[];
  related: string[];
  keywords: string[];
  updated?: Date;
  body: string; // markdown body, frontmatter stripped
}

export interface RelatedTarget {
  kind: 'glossary' | 'post' | 'project';
  slug: string;
  href: string; // locale-aware, e.g. '/glossary/cuped/' or '/en/glossary/cuped/'
  title: string;
}

export interface BacklinkSource {
  kind: 'post' | 'project';
  slug: string;
  href: string;
  title: string;
  body: string;
}

/** Category display order (matches the `termSchema` enum in content.config.ts). */
export const GLOSSARY_CATEGORIES: GlossaryCategory[] = [
  'statistics',
  'experiment',
  'product',
  'data',
  'business',
];

export const CATEGORY_LABELS: Record<GlossaryCategory, { ru: string; en: string }> = {
  statistics: { ru: 'Статистика', en: 'Statistics' },
  experiment: { ru: 'Эксперименты', en: 'Experiments' },
  product: { ru: 'Продукт', en: 'Product' },
  data: { ru: 'Данные', en: 'Data' },
  business: { ru: 'Бизнес', en: 'Business' },
};

/** Locale path prefix: RU lives at the root, EN under `/en/`. */
function langPrefix(lang: GlossaryLang): string {
  return lang === 'en' ? '/en/' : '/';
}

/** '/glossary/<slug>/' for ru, '/en/glossary/<slug>/' for en */
export function termHref(slug: string, lang: GlossaryLang): string {
  return `${langPrefix(lang)}glossary/${slug}/`;
}

function relatedHref(kind: 'glossary' | 'post' | 'project', slug: string, lang: GlossaryLang): string {
  const segment = kind === 'glossary' ? 'glossary' : kind === 'post' ? 'posts' : 'projects';
  return `${langPrefix(lang)}${segment}/${slug}/`;
}

/**
 * Pure: parse one related path. '/glossary/x/' -> {kind:'glossary',slug:'x'};
 * '/posts/x/' and '/projects/x/' likewise; anything else -> null. Tolerates
 * leading/trailing slashes and a missing trailing slash. Mirrors the
 * related-path shape resolved in `src/pages/posts/[slug].astro`.
 */
export function parseRelatedPath(
  raw: string,
): { kind: 'glossary' | 'post' | 'project'; slug: string } | null {
  if (typeof raw !== 'string') return null;
  const segments = raw.trim().split('/').filter((s) => s.length > 0);
  if (segments.length !== 2) return null;
  const [head, slug] = segments;
  if (!slug) return null;
  if (head === 'glossary') return { kind: 'glossary', slug };
  if (head === 'posts') return { kind: 'post', slug };
  if (head === 'projects') return { kind: 'project', slug };
  return null;
}

/**
 * Resolve raw related strings against per-kind lookups; drop unresolved; keep
 * input order.
 */
export function resolveRelated(
  related: string[],
  lang: GlossaryLang,
  lookups: {
    glossary: { slug: string; title: string }[];
    posts: { slug: string; title: string }[];
    projects: { slug: string; title: string }[];
  },
): RelatedTarget[] {
  const titles: Record<'glossary' | 'post' | 'project', Map<string, string>> = {
    glossary: new Map(lookups.glossary.map((t) => [t.slug, t.title])),
    post: new Map(lookups.posts.map((t) => [t.slug, t.title])),
    project: new Map(lookups.projects.map((t) => [t.slug, t.title])),
  };
  const out: RelatedTarget[] = [];
  for (const raw of related) {
    const parsed = parseRelatedPath(raw);
    if (!parsed) continue;
    const title = titles[parsed.kind].get(parsed.slug);
    if (title === undefined) continue;
    out.push({
      kind: parsed.kind,
      slug: parsed.slug,
      href: relatedHref(parsed.kind, parsed.slug, lang),
      title,
    });
  }
  return out;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const WORD_CHAR = /[A-Za-z0-9_]/;

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && ch !== '' && WORD_CHAR.test(ch);
}

/**
 * Case-insensitive, word-boundary substring test. `\b` is unusable here: it
 * keys off `\w`, so it mis-fires on `p-value`, `DAU/MAU`, `north star`. Instead
 * we scan every occurrence and accept it only when the characters immediately
 * before and after the match are not `[A-Za-z0-9_]`.
 */
function mentions(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const re = new RegExp(escapeRegExp(needle), 'gi');
  let match: RegExpExecArray | null;
  while ((match = re.exec(haystack)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (!isWordChar(haystack[start - 1]) && !isWordChar(haystack[end])) return true;
    if (match[0].length === 0) re.lastIndex += 1; // safety: never loop on an empty match
  }
  return false;
}

/**
 * Term slug -> list of posts/projects whose title or body mentions the term
 * title or any alias (word-boundary, case-insensitive). A source that IS the
 * term (same slug & kind) is skipped. Every term in `terms` gets an entry.
 */
export function computeBacklinks(
  terms: { slug: string; title: string; aka: string[] }[],
  sources: BacklinkSource[],
): Record<string, BacklinkSource[]> {
  const result: Record<string, BacklinkSource[]> = {};
  for (const term of terms) {
    const needles = [term.title, ...term.aka].filter((n): n is string => Boolean(n));
    result[term.slug] = sources.filter((source) => {
      // `BacklinkSource.kind` is `'post' | 'project'`; a glossary source can
      // only reach here through a widened caller, so guard defensively.
      if ((source.kind as string) === 'glossary' && source.slug === term.slug) return false;
      return needles.some((n) => mentions(source.title, n) || mentions(source.body, n));
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Disk loader — testable without Astro. Reads .md files under
// `src/content/<glossary|glossary-en>`, strips frontmatter, skips files whose
// name starts with `_` and entries marked `draft: true`.
// ---------------------------------------------------------------------------

const GLOSSARY_DIR: Record<GlossaryLang, string> = {
  ru: 'glossary',
  en: 'glossary-en',
};

function toDate(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? undefined : value;
  const date = new Date(String(value));
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Split `---` frontmatter from the markdown body; tolerant of a missing block. */
function splitFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const text = raw.replace(/^﻿/, '');
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/.exec(text);
  if (!match) return { data: {}, body: text };
  const parsed = parse(match[1]);
  return {
    data: parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {},
    // Drop the blank line(s) authors leave between frontmatter and content.
    body: text.slice(match[0].length).replace(/^[\r\n]+/, ''),
  };
}

function collectMarkdownFiles(dir: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectMarkdownFiles(full));
    else if (entry.isFile() && /\.mdx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Load every published term for a locale straight from disk. `repoRoot` is the
 * project root (so tests can pass `process.cwd()`).
 */
export function loadGlossaryFromDisk(repoRoot: string, lang: GlossaryLang): GlossaryTerm[] {
  const dir = path.join(repoRoot, 'src', 'content', GLOSSARY_DIR[lang]);
  return collectMarkdownFiles(dir)
    .sort()
    .map((file): GlossaryTerm | null => {
      const { data, body } = splitFrontmatter(readFileSync(file, 'utf-8'));
      if (data.draft === true) return null;
      const category = (
        typeof data.category === 'string' ? data.category : 'statistics'
      ) as GlossaryCategory;
      return {
        slug: path.basename(file).replace(/\.mdx?$/, ''),
        lang,
        title: typeof data.title === 'string' ? data.title : '',
        description: typeof data.description === 'string' ? data.description : '',
        aka: asStringArray(data.aka),
        category,
        tags: asStringArray(data.tags),
        related: asStringArray(data.related),
        keywords: asStringArray(data.keywords),
        updated: toDate(data.updated),
        body,
      };
    })
    .filter((t): t is GlossaryTerm => t !== null);
}
