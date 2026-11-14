/**
 * Matching for the build-time JSON index (`/search-index.json`), run in the
 * browser by the homepage hero search. Pagefind folds its own index, so nothing
 * here touches the header search path.
 *
 * Lives in `lib/` rather than inline in `HomeNewTab.astro` so the ranking rules
 * have a runnable check — they are the whole feature and were previously only
 * observable by typing into the page.
 */
import { bestWordIn, stemsOf, typoBudget, wordsOf } from "./fuzzy";
import { stemRu, translitRu } from "./translit";

export type SearchEntry = {
  type: string;
  locale: string;
  title: string;
  desc: string;
  tags?: string[];
  tools?: string[];
  href: string;
  date?: string | null;
  /** ru→lat haystack for desc/body, produced by the index endpoint. */
  translit?: string;
  /** Long searchable text (shelf notes). Never rendered. */
  body?: string;
};

export type PreparedEntry = {
  e: SearchEntry;
  title: string;
  desc: string;
  tags: string[];
  tools: string[];
  ts: number;
  /** Folded once here, not on every keystroke. */
  titleWords: string[];
  metaWords: string[];
  /** Folded `body` — shelf notes are searchable only through this. */
  body: string;
  /** Latin title, so a transliterated query can reach a Cyrillic one. */
  translitTitle: string;
  /** Folded endpoint-supplied translit haystack (desc/body). */
  translitHay: string;
  /** Stems, precomputed because scoring runs once per keystroke. */
  titleStems: string[];
  tagStems: string[];
  toolStems: string[];
  /** Split by field: `desc` is a native match, `body` only ranks. */
  descStems: string[];
  bodyStems: string[];
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
  return entries.map((e) => {
    const body = normalize(e.body ?? "");
    const meta = [...(e.tags ?? []), ...(e.tools ?? []), e.desc ?? "", e.body ?? ""];
    const tagWords = (e.tags ?? []).flatMap((x) => wordsOf(normalize(x)));
    const toolWords = (e.tools ?? []).flatMap((x) => wordsOf(normalize(x)));
    const descWords = wordsOf(normalize(e.desc ?? ""));
    const bodyWords = wordsOf(body);
    return {
      e,
      title: normalize(e.title),
      desc: normalize(e.desc || ""),
      tags: (e.tags || []).map(normalize),
      tools: (e.tools || []).map(normalize),
      body,
      ts: e.date ? Date.parse(e.date) || 0 : 0,
      titleWords: wordsOf(normalize(e.title)),
      metaWords: meta.flatMap((x) => wordsOf(normalize(x))),
      translitTitle: translitRu(e.title || ""),
      translitHay: normalize(e.translit ?? ""),
      titleStems: stemsOf(wordsOf(normalize(e.title))),
      tagStems: stemsOf(tagWords),
      toolStems: stemsOf(toolWords),
      descStems: stemsOf(descWords),
      bodyStems: stemsOf(bodyWords),
    };
  });
}

/**
 * Tier ladder, highest first. An exact title (`6`) beats a stem-equal title
 * (`5`), which beats a prefix (`4`) and an includes (`3`); metadata tiers keep
 * their old low weights, with stem equality/prefix landing on the same weight
 * as a substring hit in that field. Transliteration is the last resort: it
 * fires only when the token matched nothing native *and* nothing fuzzy, which
 * is what keeps "vozvratnost" below every Cyrillic hit.
 *
 * `matched` counts the tokens that landed somewhere, so the caller can fall
 * back from "all tokens" to "any token" without scoring twice.
 */
function scoreEntry(p: PreparedEntry, tokens: string[]) {
  let s = 0;
  let matched = 0;
  for (const tk of tokens) {
    let add = 0;
    const stem = stemRu(tk);
    let titleAdd = 0;
    if (p.title === tk) titleAdd = 6;
    else if (p.titleStems.includes(stem)) titleAdd = 5;
    else if (p.title.startsWith(tk)) titleAdd = 4;
    else if (p.title.includes(tk)) titleAdd = 3;
    add += titleAdd;
    let tagAdd = 0;
    if (p.tags.some((x) => x === tk)) tagAdd = 3;
    else if (p.tags.some((x) => x.includes(tk))) tagAdd = 2;
    else if (p.tagStems.some((x) => x === stem || x.startsWith(stem))) tagAdd = 2;
    add += tagAdd;
    let toolAdd = 0;
    if (p.tools.some((x) => x === tk)) toolAdd = 2;
    else if (p.tools.some((x) => x.includes(tk))) toolAdd = 1;
    else if (p.toolStems.some((x) => x === stem || x.startsWith(stem))) toolAdd = 1;
    add += toolAdd;
    // `desc` is the blurb and counts as a native match; `body` is the page
    // substance and only ranks. Counting a body-only hit as native would leave
    // the AND set almost never empty, and the ANY fallback that multi-word
    // queries depend on would never fire.
    const descHit =
      p.desc.includes(tk) || p.descStems.some((x) => x === stem || x.startsWith(stem));
    const bodyHit =
      !descHit &&
      (p.body.includes(tk) || p.bodyStems.some((x) => x === stem || x.startsWith(stem)));
    const metaAdd = descHit || bodyHit ? 1 : 0;
    add += metaAdd;
    // A typo fills a gap but never outranks an exact/prefix/includes/stem match
    // in the same field: every tier above scores at least 1, a 1-edit title hit
    // is 2, and — crucially — a field that already matched natively gets no
    // typo bonus at all, so it cannot be pushed past a literal hit.
    const budget = typoBudget(tk);
    if (budget) {
      if (titleAdd === 0) {
        const inTitle = bestWordIn(tk, p.titleWords, budget);
        if (inTitle === 1) add += 2;
        else if (inTitle === 2) add += 1;
      }
      if (metaAdd === 0 && bestWordIn(tk, p.metaWords, budget) === 1) add += 1;
    }
    if (add === 0) {
      // `translitRu` copies Latin through, so a token already typed in translit
      // ("vozvratnost") and a token typed in Cyrillic ("возвратность") both
      // compare equal against the same Latin form.
      const lat = translitRu(tk);
      // A one-letter Latin form matches half the site.
      if (lat.length >= 2) {
        if (p.translitTitle === lat) add += 3;
        else if (p.translitTitle.includes(lat)) add += 2;
        else if (p.translitHay.includes(lat)) add += 1;
      }
    }
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
  // AND over *native* fields only. A row that matches every token solely
  // through its body still ranks — but it must not be the reason the ANY
  // fallback never fires, so a body-only match cannot satisfy the AND set.
  const strict = scored.filter((x) => x.matched === tokens.length);
  const hits = (strict.length ? strict : scored.filter((x) => x.matched > 0)).sort(
    (a, b) => b.s - a.s || b.p.ts - a.p.ts,
  );
  // Three passes over the same score-ordered array: one row per type, then two,
  // then everything left. Without this a single type (posts outnumber every
  // other type in the index) owned the whole six-row list.
  //
  // Deterministic: `sort` is stable, every pass walks `hits` in the same order,
  // and a pass only skips a row while its type is at the cap — so a
  // strictly-better row is never dropped while the list still has room.
  const out: typeof hits = [];
  const taken = new Set<number>();
  const used = new Map<string, number>();
  for (const cap of [1, 2, Infinity]) {
    for (let i = 0; i < hits.length && out.length < limit; i++) {
      if (taken.has(i)) continue;
      const type = hits[i].p.e.type;
      const n = used.get(type) ?? 0;
      if (n >= cap) continue;
      taken.add(i);
      used.set(type, n + 1);
      out.push(hits[i]);
    }
  }
  return out.map((x) => x.p.e);
}

/**
 * Lowercase + `ё`→`е`, one code unit at a time. The contract here is offsets
 * *into the original text*, so the fold must not change length: each unit is
 * replaced only when its lowercase is itself one unit, and astral characters
 * (surrogate pairs, whose units lowercase to themselves) pass through intact.
 */
function foldLengthSafe(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    let low = ch.toLowerCase();
    if (low === "ё") low = "е";
    out += low.length === 1 ? low : ch;
  }
  return out;
}

const WORD = /[\p{L}\p{N}]+/gu;

/**
 * Spans of `text` a query should mark, as ascending, non-overlapping
 * `[start, end)` code-unit offsets into the *original* `text`. The UI turns
 * these into `<mark>` with `textContent`, never with HTML — offsets are the only
 * thing crossing over, so nothing here can inject markup.
 *
 * A word is marked whole when either the token occurs in it, or the token's
 * stem is a prefix of the word's stem — that is what lets «выбросы» mark
 * «выбросам», which plain occurrence search cannot see.
 */
export function highlightRanges(text: string, tokens: string[]): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  const folded = foldLengthSafe(text);
  for (const token of tokens) {
    const ft = foldLengthSafe(token);
    // One-character tokens mark every other letter.
    if (ft.length < 2) continue;
    let from = 0;
    for (;;) {
      const at = folded.indexOf(ft, from);
      if (at === -1) break;
      spans.push([at, at + ft.length]);
      // Step one unit, not `ft.length`: overlapping occurrences still count.
      from = at + 1;
    }
    const stem = stemRu(ft);
    if (stem.length >= 3) {
      WORD.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = WORD.exec(folded))) {
        if (stemRu(m[0]).startsWith(stem)) spans.push([m.index, m.index + m[0].length]);
      }
    }
  }
  spans.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [];
  for (const [start, end] of spans) {
    const last = merged[merged.length - 1];
    // Overlap (or a duplicate from a repeated token) extends the open range.
    if (last && start < last[1]) {
      if (end > last[1]) last[1] = end;
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}
