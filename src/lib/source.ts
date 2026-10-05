/**
 * The shelf vocabulary. It lives here — in a module with no imports — because two
 * consumers must agree on it: the Zod schema in `src/content.config.ts` (which may
 * not import anything that pulls in `astro:content`, hence the separate file) and
 * the loader in `src/lib/library.ts`. One copy, so the closed sets cannot drift.
 *
 * `kind` answers "what is this?" and `status` answers "what is it to me?". They
 * replaced a single free-text `tag`, which was neither: it drifted between
 * "Читаю сейчас" / "Сейчас читаю" / "Reading" with nothing to catch the split.
 */
export const SOURCE_KINDS = ['book', 'course', 'paper', 'talk'] as const;
export const SOURCE_STATUSES = ['reading', 'reference', 'done'] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

/**
 * Kinds whose tile is useless without a link to the thing itself: a paper or a
 * talk is not something a reader can go and find by title alone. A book already
 * has an author and a publisher, so `url` stays optional there.
 */
export const KINDS_NEEDING_URL: readonly SourceKind[] = ['paper', 'talk'];
