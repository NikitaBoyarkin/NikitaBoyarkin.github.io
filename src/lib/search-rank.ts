/**
 * Matching for the build-time JSON index (`/search-index.json`), run in the
 * browser by the homepage hero search. Pagefind folds its own index, so nothing
 * here touches the header search path.
 *
 * Lives in `lib/` rather than inline in `HomeNewTab.astro` so the ranking rules
 * have a runnable check — they are the whole feature and were previously only
 * observable by typing into the page.
 */

export type SearchEntry = {
  type: string;
  locale: string;
  title: string;
  desc: string;
  tags?: string[];
  tools?: string[];
  href: string;
  date?: string | null;
};

export type PreparedEntry = {
  e: SearchEntry;
  title: string;
  desc: string;
  tags: string[];
  tools: string[];
  ts: number;
};

export type PreparedIndex = PreparedEntry[];

/**
 * Deliberately NOT `normalize('NFKD')` + mark-stripping: that decomposes the
 * Cyrillic `й` into `и` + a combining breve, so "май" would stop matching itself
 * and start matching "маи". Only `ё` is folded — the one Russian equivalence
 * users actually type both ways.
 */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е");
}

export function tokenize(q: string): string[] {
  return q
    .trim()
    .split(/\s+/)
    .map(normalize)
    .filter(Boolean);
}

/** Fold each entry's searchable text once, not on every keystroke. */
export function prepareIndex(entries: SearchEntry[]): PreparedIndex {
  return entries.map((e) => ({
    e,
    title: normalize(e.title),
    desc: normalize(e.desc || ""),
    tags: (e.tags || []).map(normalize),
    tools: (e.tools || []).map(normalize),
    ts: e.date ? Date.parse(e.date) || 0 : 0,
  }));
}

/** `matched` counts the tokens that landed somewhere, so the caller can fall
 *  back from "all tokens" to "any token" without scoring twice. */
function scoreEntry(p: PreparedEntry, tokens: string[]) {
  let s = 0;
  let matched = 0;
  for (const tk of tokens) {
    let add = 0;
    if (p.title === tk) add += 6;
    else if (p.title.startsWith(tk)) add += 4;
    else if (p.title.includes(tk)) add += 3;
    if (p.tags.some((x) => x === tk)) add += 3;
    else if (p.tags.some((x) => x.includes(tk))) add += 2;
    if (p.tools.some((x) => x === tk)) add += 2;
    else if (p.tools.some((x) => x.includes(tk))) add += 1;
    if (p.desc.includes(tk)) add += 1;
    if (add > 0) matched += 1;
    s += add;
  }
  return { s, matched };
}

export function rankEntries(
  index: PreparedIndex,
  tokens: string[],
  locale: "ru" | "en",
  limit: number,
): SearchEntry[] {
  const pool = index.filter(
    // Topic hubs are RU-only pages, so they must stay reachable from `/en/`.
    (p) => p.e.locale === locale || p.e.type === "topic",
  );
  const scored = pool.map((p) => ({ p, ...scoreEntry(p, tokens) }));
  // AND first; only when it comes back empty does a partial match count.
  // Multi-word queries used to return nothing the moment one token missed.
  const strict = scored.filter((x) => x.matched === tokens.length);
  const hits = strict.length ? strict : scored.filter((x) => x.matched > 0);
  return hits
    .sort((a, b) => b.s - a.s || b.p.ts - a.p.ts)
    .slice(0, limit)
    .map((x) => x.p.e);
}
