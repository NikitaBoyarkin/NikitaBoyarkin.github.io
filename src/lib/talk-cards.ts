// Payload for the /talks/ talk card (<TalkCard>). One row per talk, already in
// programme order, so the dialog's prev/next is the array index and the browser
// never re-derives the sort that /programme/ shows. Same order as the programme
// panel: `data.days` order (1 день → 2 день → онлайн-день), then start time,
// then title.
import { talkTitle, trackName, type TalksData, type TalksOverlay, type TalksTalk } from './talks-graph';

export interface TalkCardItem {
  id: number;
  title: string;
  time: string;
  hall: string;
  track: string | null;
  day: string;
  lectors: { name: string; role: string }[];
  short: string;
  themes: { id: string; label: string }[];
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
): TalkCardItem[] {
  const isEn = lang === 'en';
  const themeById = new Map(data.themes.map((th) => [th.id, th]));
  const dayById = new Map(data.days.map((d) => [d.id, d]));

  return programmeOrder(data).map((talk) => ({
    id: talk.id,
    title: talkTitle(talk, lang, overlay),
    time: `${talk.start}–${talk.end}`,
    hall: talk.hall,
    // The source leaves ~30% of the programme without a track; the card says so
    // with `null` rather than printing an empty string next to the label.
    track: talk.trackName ? trackName(talk.trackName, lang, overlay) : null,
    day: dayById.get(talk.dayId)?.name ?? '',
    lectors: talk.lectors.map((l) => ({ name: l.name, role: l.role })),
    short: talk.short ?? '',
    themes: (talk.themes ?? []).flatMap((id) => {
      const theme = themeById.get(id);
      if (!theme) return [];
      return [{ id, label: isEn ? theme.labelEn : theme.label }];
    }),
  }));
}
