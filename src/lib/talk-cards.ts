// Payload for the /talks/ talk card (<TalkCard>). One row per talk, already in
// programme order, so the dialog's prev/next is the array index and the browser
// never re-derives the sort that /programme/ shows. Same order as the programme
// panel: `data.days` order (1 день → 2 день → онлайн-день), then start time,
// then title.
import { talkTitle, trackName, type TalksData, type TalksOverlay, type TalksTalk } from './talks-graph';
import type { RelatedTalk } from './talks-related';

export interface TalkCardRelated {
  /** Talk id, the same key `#t<id>` uses — the title is resolved from the cards
   *  array by the dialog, so 230 links do not duplicate 230 titles into the
   *  JSON island. */
  id: number;
  /** Pre-localized reason, ready to print: theme labels joined, or the
   *  structural reason when no theme ties the pair. */
  why: string;
}

export interface TalkCardItem {
  id: number;
  title: string;
  time: string;
  hall: string;
  /** Display label for the dialog, already localized. */
  track: string | null;
  /** The programme's own track slug (`avito`, …), null for untracked talks.
   *  Analytics needs the stable key, not the label: `/talks/` and `/en/talks/`
   *  print two different names for the same track. */
  trackSlug: string | null;
  /** Numeric track id from the programme feed — the key shared with
   *  `mm-program-page`, and the only one that survives a language switch. */
  trackId: number | null;
  day: string;
  lectors: { name: string; role: string }[];
  short: string;
  themes: { id: string; label: string }[];
  /** Zettelkasten neighbours (lib/talks-related.ts), reasons pre-localized. */
  related: TalkCardRelated[];
}

export interface TalkCardOptions {
  /** Related index from `relatedTalks(data)`; omitted → every card carries an
   *  empty list, which keeps the other callers and the unit tests unchanged. */
  related?: Map<number, RelatedTalk[]>;
  /** Localized structural reasons, because copy lives in lib/talks-copy.ts. */
  why?: { track: string; room: string };
}

/** Talks in programme order. `data.days` is authored in programme order, so the
 *  array index is the sort key — chronological order by date would put the
 *  online day (last date) where the programme puts it first. */
export function programmeOrder(data: TalksData): TalksTalk[] {
  const dayIndex = new Map(data.days.map((d, i) => [d.id, i]));
  return [...data.talks].sort(
    (a, b) =>
      (dayIndex.get(a.dayId) ?? data.days.length) - (dayIndex.get(b.dayId) ?? data.days.length) ||
      a.start.localeCompare(b.start) ||
      a.title.localeCompare(b.title, 'ru'),
  );
}

export function buildTalkCards(
  data: TalksData,
  lang: 'ru' | 'en' = 'ru',
  overlay?: TalksOverlay,
  options: TalkCardOptions = {},
): TalkCardItem[] {
  const isEn = lang === 'en';
  const themeById = new Map(data.themes.map((th) => [th.id, th]));
  const dayById = new Map(data.days.map((d) => [d.id, d]));
  const why = options.why ?? { track: '', room: '' };

  return programmeOrder(data).map((talk) => ({
    id: talk.id,
    title: talkTitle(talk, lang, overlay),
    time: `${talk.start}–${talk.end}`,
    hall: talk.hall,
    // The source leaves ~30% of the programme without a track; the card says so
    // with `null` rather than printing an empty string next to the label.
    track: talk.trackName ? trackName(talk.trackName, lang, overlay) : null,
    trackSlug: talk.trackSlug || null,
    trackId: talk.trackId ?? null,
    day: dayById.get(talk.dayId)?.name ?? '',
    lectors: talk.lectors.map((l) => ({ name: l.name, role: l.role })),
    short: talk.short ?? '',
    themes: (talk.themes ?? []).flatMap((id) => {
      const theme = themeById.get(id);
      if (!theme) return [];
      return [{ id, label: isEn ? theme.labelEn : theme.label }];
    }),
    related: (options.related?.get(talk.id) ?? []).map((rel) => ({
      id: rel.id,
      why: rel.sharedThemes.length
        ? rel.sharedThemes
            .slice(0, 2)
            .flatMap((id) => {
              const theme = themeById.get(id);
              return theme ? [isEn ? theme.labelEn : theme.label] : [];
            })
            .join(' · ')
        : rel.sameTrack
          ? why.track
          : why.room,
    })),
  }));
}
