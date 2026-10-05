// Library shelf loader. Every consumer — the /library/ index, the per-source
// pages, the bento cell on the homepage, the "Сейчас" line on /about/ — goes
// through here rather than reading a collection directly.
//
// Why a module and not the pages: `getStaticPaths` is compiled into a separate
// module where frontmatter bindings are out of scope, so the source page routes
// must come from an importable helper (the same reason `lib/posts.ts` exists).
//
// Why the tile href is computed here and not stored in the note: a path written
// into frontmatter can drift into the wrong locale — an EN note carrying the bare
// `now/` builds green and sends the English reader to the Russian page. Nothing
// authors the locale prefix any more, so there is nothing to get wrong.
import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { withBase } from './path';
import type { SourceKind, SourceStatus } from './source';

export type Lang = 'ru' | 'en';

/** Both collections share `bookSchema`, so the entry shapes are identical and
 *  the only difference is the `collection` literal. */
export type SourceEntry = CollectionEntry<'library'>;

export function slugOf(id: string): string {
  return id.replace(/\.mdx?$/, '');
}

/** The source's own page, inside the reader's locale. */
export function sourceHref(lang: Lang, id: string): string {
  return withBase(`${lang === 'en' ? 'en/' : ''}library/${slugOf(id)}/`);
}

/** The shelf index for a locale. */
export function shelfHref(lang: Lang): string {
  return withBase(lang === 'en' ? 'en/library/' : 'library/');
}

export const KIND_LABELS: Record<Lang, Record<SourceKind, string>> = {
  ru: { book: 'Книга', course: 'Курс', paper: 'Статья', talk: 'Доклад' },
  en: { book: 'Book', course: 'Course', paper: 'Paper', talk: 'Talk' },
};

export const STATUS_LABELS: Record<Lang, Record<SourceStatus, string>> = {
  ru: { reading: 'Читаю', reference: 'Справочник', done: 'Прочитано' },
  en: { reading: 'Reading', reference: 'Reference', done: 'Read' },
};

export async function loadSources(lang: Lang): Promise<SourceEntry[]> {
  const shelf =
    lang === 'en'
      ? await getCollection('library-en', (s) => !s.data.draft)
      : await getCollection('library', (s) => !s.data.draft);
  return [...(shelf as unknown as SourceEntry[])].sort(
    (a, b) => a.data.order - b.data.order
  );
}

/** The shelf as the homepage cell shows it: the first few, in shelf order. */
export async function loadFeaturedSources(lang: Lang, limit = 3): Promise<SourceEntry[]> {
  return (await loadSources(lang)).slice(0, limit);
}
