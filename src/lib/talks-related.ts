// Zettelkasten links for the programme: for every talk, the short list of talks
// it is actually related to, plus *why* — so a reader can jump sideways instead
// of scrolling 91 entries in programme order.
//
// This is deliberately NOT the graph. `lib/talks-graph.ts` keeps one level of
// grouping (event → 12 tracks → 91 talks, 103 edges) because the full mesh was
// 703 edges and unreadable; `tests/lib/talks-graph.test.ts` pins that shape. The
// relation therefore lives in its own module and its own return type, and the
// graph builders never see it.
//
// What the data can honestly support, measured on the real 91 talks:
//   - themes: 11 tags, but wildly uneven (`ai` 52/91, `product` 44, `metrics` 32
//     vs `retention` 5, `causal` 7). Unweighted overlap is what made talk 276 the
//     hub of 61 of 91 talks; IDF weights alone do not fix it either, because the
//     6 talks whose only tag is `ai` score cosine 1.0 against each other. Hence
//     the specificity gate: one shared theme only counts as `1 − df/N` of itself.
//   - speakers: 94 names, 94 distinct — zero shared-speaker edges exist.
//   - `highlighted`: false on all 91 talks — dead field, not used.
//   - blurbs: TF-IDF cosine (title + short, RU stop words) peaks at 0.213 with
//     only 3 pairs above 0.13, so text is a weak tiebreaker at best. It is left
//     out on purpose: it changed 7 of 235 pairs, and a signal that weak does not
//     earn its explanation in the UI.
//   - structure: same track (182 pairs), adjacent slot in the same hall and day
//     (78 pairs) — both are real and cheap to explain.
//
// The result is symmetric on purpose: if A lists B, B lists A. A one-way "see
// also" is a recommendation; a two-way link is a zettelkasten backlink, and the
// page states the reason next to each one.
import type { TalksData, TalksTalk } from './talks-graph';

/** Neighbours a talk nominates before symmetrisation. Four keeps the list a
 *  curation rather than a dump; the symmetric union then grows it to 1–12
 *  (median 5), which is what the page prints. */
export const RELATED_K = 4;

/** Below this the pair is not a relation: 1.6 (same track) + 0.2 (same day) is
 *  a coincidence of scheduling, not a shared idea. */
export const RELATED_THRESHOLD = 2;

/** A talk with fewer than this many scored neighbours gets topped up from its
 *  own track, or from its own room — the four talks the programme leaves without
 *  themes would otherwise print an empty list. One is enough: a second forced
 *  neighbour turns the fallback into noise (it paired 271 with 324 on nothing
 *  but the `ai` tag). */
export const RELATED_MIN = 1;

export interface RelatedTalk {
  /** Talk id, the same key `#t<id>` anchors use. */
  id: number;
  /** Ranking score, kept for the tests and for stable ordering. */
  score: number;
  /** Shared theme ids, rarest first — the reason the pair exists. */
  sharedThemes: string[];
  /** Both talks sit in the same programme track. */
  sameTrack: boolean;
  /** The talks are neighbours in one hall's run, so a reader can walk between
   *  them without leaving the room. */
  adjacent: boolean;
  /** Same hall on the same day. Only a fallback reason: it says where the talk
   *  is, not what it is about, and the page labels it as such. */
  sameRoom: boolean;
}

/** Inverse document frequency per theme: a tag on 5 of 91 talks says far more
 *  about a pair than a tag on 52. */
export function themeIdf(data: TalksData): Map<string, number> {
  const df = new Map<string, number>();
  for (const talk of data.talks) {
    for (const theme of new Set(talk.themes ?? [])) df.set(theme, (df.get(theme) ?? 0) + 1);
  }
  const n = data.talks.length;
  const idf = new Map<string, number>();
  for (const [theme, count] of df) idf.set(theme, Math.log(1 + n / count));
  return idf;
}

const weight = (idf: Map<string, number>, theme: string) => idf.get(theme) ?? 0;

/** Cosine over IDF-weighted themes, damped when the pair shares exactly one
 *  theme: two talks that are both only "AI" are not therefore the same talk. */
function themeSimilarity(
  a: TalksTalk,
  b: TalksTalk,
  idf: Map<string, number>,
  df: Map<string, number>,
  n: number,
): { score: number; shared: string[] } {
  const left = new Set(a.themes ?? []);
  const right = new Set(b.themes ?? []);
  const shared = [...left].filter((theme) => right.has(theme));
  if (shared.length === 0) return { score: 0, shared: [] };

  const dot = shared.reduce((sum, theme) => sum + weight(idf, theme) ** 2, 0);
  const normA = Math.sqrt([...left].reduce((sum, theme) => sum + weight(idf, theme) ** 2, 0));
  const normB = Math.sqrt([...right].reduce((sum, theme) => sum + weight(idf, theme) ** 2, 0));
  const cosine = normA && normB ? dot / (normA * normB) : 0;
  const gate = shared.length >= 2 ? 1 : 1 - (df.get(shared[0]) ?? 0) / n;

  shared.sort((x, y) => weight(idf, y) - weight(idf, x) || x.localeCompare(y));
  return { score: cosine * gate, shared };
}

/** Programme position, so the fallback can prefer the talk right next door.
 *  `data.days` is authored in programme order (online day last), and the sort
 *  below matches `programmeOrder` in lib/talk-cards.ts without importing it. */
function programmeOrder(data: TalksData): Map<number, number> {
  const day = new Map(data.days.map((d, i) => [d.id, i]));
  const ordered = [...data.talks].sort(
    (a, b) =>
      (day.get(a.dayId) ?? data.days.length) - (day.get(b.dayId) ?? data.days.length) ||
      a.start.localeCompare(b.start) ||
      a.title.localeCompare(b.title, 'ru'),
  );
  return new Map(ordered.map((talk, i) => [talk.id, i]));
}

/** Hall runs: talks that follow each other in one room on one day. */
function adjacentPairs(data: TalksData): Set<string> {
  const runs = new Map<string, TalksTalk[]>();
  for (const talk of data.talks) {
    const key = `${talk.dayId}\u0000${talk.hallSlug}`;
    const run = runs.get(key) ?? [];
    run.push(talk);
    runs.set(key, run);
  }
  const pairs = new Set<string>();
  for (const run of runs.values()) {
    run.sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < run.length; i++) {
      pairs.add(`${run[i - 1].id}:${run[i].id}`);
      pairs.add(`${run[i].id}:${run[i - 1].id}`);
    }
  }
  return pairs;
}

/**
 * Related talks for every talk in the programme, keyed by talk id.
 *
 * Deterministic by construction: candidates are ranked by `(-score, id)` and the
 * only other ordering input is the programme order of the data, so two builds
 * from the same `talks.json` are byte-identical (same contract as
 * `buildTalksGraph`).
 */
export function relatedTalks(
  data: TalksData,
  k: number = RELATED_K,
): Map<number, RelatedTalk[]> {
  const idf = themeIdf(data);
  const df = new Map<string, number>();
  for (const talk of data.talks) {
    for (const theme of new Set(talk.themes ?? [])) df.set(theme, (df.get(theme) ?? 0) + 1);
  }
  const n = data.talks.length;
  const order = programmeOrder(data);
  const adjacent = adjacentPairs(data);

  const scored = new Map<string, number>();
  const reasons = new Map<string, Pick<RelatedTalk, 'sharedThemes' | 'sameTrack' | 'adjacent' | 'sameRoom'>>();
  const score = (a: TalksTalk, b: TalksTalk) => {
    const key = `${a.id}:${b.id}`;
    const cached = scored.get(key);
    if (cached !== undefined) return cached;
    const theme = themeSimilarity(a, b, idf, df, n);
    const sameTrack = Boolean(a.trackSlug) && a.trackSlug === b.trackSlug;
    const next = adjacent.has(key);
    const sameRoom = a.hallSlug === b.hallSlug && a.dayId === b.dayId;
    let total = 4 * theme.score;
    if (sameTrack) total += 1.6;
    if (next) total += 0.9;
    if (a.dayId === b.dayId) total += 0.2;
    scored.set(key, total);
    reasons.set(key, { sharedThemes: theme.shared, sameTrack, adjacent: next, sameRoom });
    return total;
  };

  // One direction: each talk nominates its best few.
  const nominated = new Map<number, number[]>();
  for (const talk of data.talks) {
    const candidates = data.talks
      .filter((other) => other.id !== talk.id)
      .map((other) => ({ id: other.id, score: score(talk, other) }))
      .filter((candidate) => candidate.score >= RELATED_THRESHOLD)
      .sort((a, b) => b.score - a.score || a.id - b.id)
      .slice(0, k)
      .map((candidate) => candidate.id);

    // Structural fallback. Four talks carry no themes, and three of those have
    // no track either, so they would print an empty "see also" — the one thing
    // a zettelkasten page must not do. The own track is a true relation; when
    // there is no track, the same room on the same day is the next honest one
    // (and the page says so instead of implying a shared idea).
    if (candidates.length < RELATED_MIN) {
      const own = new Set(candidates);
      const close = data.talks
        .filter(
          (other) =>
            other.id !== talk.id &&
            !own.has(other.id) &&
            ((talk.trackSlug && other.trackSlug === talk.trackSlug) ||
              (other.hallSlug === talk.hallSlug && other.dayId === talk.dayId)),
        )
        .sort(
          (a, b) =>
            Number(!adjacent.has(`${talk.id}:${b.id}`)) - Number(!adjacent.has(`${talk.id}:${a.id}`)) ||
            Math.abs((order.get(a.id) ?? 0) - (order.get(talk.id) ?? 0)) -
              Math.abs((order.get(b.id) ?? 0) - (order.get(talk.id) ?? 0)) ||
            a.id - b.id,
        );
      for (const other of close.slice(0, RELATED_MIN - candidates.length)) {
        score(talk, other);
        candidates.push(other.id);
      }
    }
    nominated.set(talk.id, candidates);
  }

  // Symmetrise: a link is a backlink. Every reason field is symmetric (shared
  // themes, same track, neighbouring slot), so a pair nominated from one side
  // reads the same from the other; only the ranking score needs no direction.
  const result = new Map<number, RelatedTalk[]>(data.talks.map((talk) => [talk.id, []]));
  const seen = new Set<string>();
  for (const [from, targets] of nominated) {
    for (const to of targets) {
      const key = [from, to].sort((a, b) => a - b).join(':');
      if (seen.has(key)) continue;
      seen.add(key);
      const reason = reasons.get(`${from}:${to}`) ?? reasons.get(`${to}:${from}`);
      if (!reason) continue;
      const pairScore = scored.get(`${from}:${to}`) ?? scored.get(`${to}:${from}`) ?? 0;
      result.get(from)!.push({ id: to, score: pairScore, ...reason });
      result.get(to)!.push({ id: from, score: pairScore, ...reason });
    }
  }
  for (const list of result.values()) list.sort((x, y) => y.score - x.score || x.id - y.id);
  return result;
}
