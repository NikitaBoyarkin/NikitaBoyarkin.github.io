// Copy for the /talks/ dashboard, RU + EN in one place.
//
// Separated from TalksBoard.astro because the two dictionaries are pure data and
// the repo's large-file guard keeps components small. The numbers a sentence
// quotes are passed in, never typed here, so a copy string cannot drift from
// `talks.json` (the caller counts talks, tracks, lectors and the widest theme).
export interface TalksCopy {
  h1: string;
  headNote: string;
  statTalks: string;
  statTracks: string;
  statUntracked: string;
  statThemes: string;
  statHalls: string;
  statLectors: string;
  statRepeat: string;
  methodNote: string;
  graphCaption: string;
  graphAria: string;
  tablistLabel: string;
  tabOverview: string;
  tabProgram: string;
  tabTracks: string;
  tabThemes: string;
  tabHalls: string;
  programH2: string;
  programNote: string;
  searchLabel: string;
  searchPlaceholder: string;
  reset: string;
  dayFilterLabel: string;
  allDays: string;
  foundTemplate: string;
  noResults: string;
  themeOnTalk: string;
  trackTablistLabel: string;
  themeTablistLabel: string;
  tracksH2: string;
  tracksNote: string;
  thTalk: string;
  thTrack: string;
  thTime: string;
  cardClose: string;
  cardPrev: string;
  cardNext: string;
  cardTime: string;
  cardHall: string;
  cardTrack: string;
  cardLectors: string;
  cardThemes: string;
  trackCaption: (name: string, n: number, k: number) => string;
  trackAria: (name: string) => string;
  noLector: string;
  themesH2: string;
  themesNote: string;
  hallsDaysH2: string;
  thHall: string;
  thDay: string;
  thDate: string;
  thTalks: string;
  sourceNote: string;
  generatorNote: string;
}

export interface TalksStats {
  event: { name: string; startDate: string; endDate: string };
  tracks: number;
  untracked: number;
  talks: number;
  widestTheme: number;
  lectors: number;
  talksWithLector: number;
  talksWithoutLector: number;
}

export function talksCopy(lang: 'ru' | 'en', s: TalksStats): TalksCopy {
  const head = `${s.event.name} · ${s.event.startDate} — ${s.event.endDate}.`;
  if (lang === 'en') {
    return {
      h1: 'Matemarketing 2026 talk graph',
      headNote: `${head} Built from the conference programme at build time.`,
      statTalks: 'talks',
      statTracks: 'tracks',
      statUntracked: 'untracked talks',
      statThemes: 'themes',
      statHalls: 'halls',
      statLectors: 'speakers',
      statRepeat: 'speakers with 2+ talks',
      methodNote: `Edges are only what the data actually holds, and the page shows them at two levels. The map below is the first level: the event, its ${s.tracks} tracks and one “Untracked” bucket (${s.untracked} talks). The second level is per track, in the Tracks section — its talks and the themes that define that track. Theme tags (AI, metrics, A/B, BI, data, marketing, HR, causal inference, retention, product, security) are not a level of the hierarchy: at programme scale they are not selective, the widest tag covers ${s.widestTheme} of ${s.talks} talks, so as hubs they would connect half the graph to everything. No two talks share a speaker: all ${s.lectors} names are distinct. A speaker is listed for ${s.talksWithLector} of ${s.talks} talks; ${s.talksWithoutLector} have none.`,
      graphCaption: `The event in the middle, gold are its ${s.tracks} tracks plus an “Untracked” bucket; each track's talks and themes are in the Tracks section. Every node is labelled; tap or click opens its section. The centre node opens the programme page.`,
      graphAria: 'Conference talk graph',
      tablistLabel: 'Talk graph sections',
      tabOverview: 'Overview',
      tabProgram: 'Programme',
      tabTracks: 'Tracks',
      tabThemes: 'Themes',
      tabHalls: 'Halls & days',
      programH2: 'Programme by day',
      programNote: `All ${s.talks} talks in start-time order, grouped by day. Search filters by title, speaker, hall, track and theme at once — the filter runs in the browser, nothing is sent anywhere.`,
      searchLabel: 'Search the programme',
      searchPlaceholder: 'title, speaker, hall or theme',
      reset: 'Reset',
      dayFilterLabel: 'Filter by day',
      allDays: 'All days',
      foundTemplate: 'Showing {n} of {total}',
      noResults: 'No talks match this query.',
      themeOnTalk: 'Themes',
      trackTablistLabel: 'Programme tracks',
      themeTablistLabel: 'Programme themes',
      tracksH2: 'Mini-graphs per track',
      tracksNote:
        'Each track is its own subgraph: the track hub, its talks, and the themes that define that track. “Untracked” holds the talks the programme leaves without a track. Theme labels after a talk open that theme.',
      thTalk: 'Talk',
      thTrack: 'Track',
      thTime: 'Time',
      cardClose: 'Close the talk card',
      cardPrev: 'Previous talk',
      cardNext: 'Next talk',
      cardTime: 'Time',
      cardHall: 'Hall',
      cardTrack: 'Track',
      cardLectors: 'Speakers',
      cardThemes: 'Themes',
      trackCaption: (name, n, k) => `Track “${name}”: ${n} talks${k > 0 ? `, ${k} themes` : ''}.`,
      trackAria: (name) => `Track mini-graph: ${name}`,
      noLector: 'no speaker',
      themesH2: 'Themes',
      themesNote:
        'Themes are tags on talks, not a level of the hierarchy: a talk lands in several of them, so the theme mentions below total more than the number of talks.',
      hallsDaysH2: 'Halls and days',
      thHall: 'Hall',
      thDay: 'Day',
      thDate: 'Date',
      thTalks: 'Talks',
      sourceNote: 'Programme source —',
      generatorNote: 'graph builder —',
    };
  }
  return {
    h1: 'Граф докладов Матемаркетинг 2026',
    headNote: `${head} Строится из программы конференции на build-time.`,
    statTalks: 'докладов',
    statTracks: 'треков',
    statUntracked: 'докладов без трека',
    statThemes: 'тем',
    statHalls: 'залов',
    statLectors: 'лекторов',
    statRepeat: 'лекторов с 2+ докладами',
    methodNote: `Связи в графе — только те, что реально есть в данных, и показаны они на двух уровнях. Карта ниже — первый: конференция, её ${s.tracks} треков и бакет «Без трека» (${s.untracked} докладов). Второй уровень — по трекам, в разделе «Треки»: доклады трека и темы, которые его определяют. Тематические теги (AI, метрики, A/B, BI, данные, маркетинг, HR, причинный вывод, retention, продукт, безопасность) — не ступень иерархии: на масштабе всей программы они не избирательны, самый широкий тег покрывает ${s.widestTheme} докладов из ${s.talks}, и как хабы они соединили бы половину графа со всем подряд. Общих лекторов нет совсем: все ${s.lectors} имени уникальны, ни одно не повторяется. Лектор указан у ${s.talksWithLector} из ${s.talks} докладов; у ${s.talksWithoutLector} его нет.`,
    graphCaption: `В центре — конференция, золотые — её ${s.tracks} треков и бакет «Без трека»; доклады и темы каждого трека — в разделе «Треки». Все узлы подписаны; касание или клик открывают соответствующий раздел, центральный узел ведёт на страницу программы.`,
    graphAria: 'Граф докладов конференции',
    tablistLabel: 'Разделы графа докладов',
    tabOverview: 'Обзор',
    tabProgram: 'Программа',
    tabTracks: 'Треки',
    tabThemes: 'Темы',
    tabHalls: 'Залы и дни',
    programH2: 'Программа по дням',
    programNote: `Все ${s.talks} докладов по времени начала, сгруппированные по дням. Поиск фильтрует сразу по названию, лектору, залу, треку и теме — фильтр работает в браузере, ничего никуда не отправляется.`,
    searchLabel: 'Поиск по программе',
    searchPlaceholder: 'название, лектор, зал или тема',
    reset: 'Сбросить',
    dayFilterLabel: 'Фильтр по дням',
    allDays: 'Все дни',
    foundTemplate: 'Показано {n} из {total}',
    noResults: 'Ни один доклад не подходит под запрос.',
    themeOnTalk: 'Темы',
    trackTablistLabel: 'Треки программы',
    themeTablistLabel: 'Темы программы',
    tracksH2: 'Мини-графы по трекам',
    tracksNote:
      'Каждый трек — отдельный подграф: хаб трека, его доклады и темы, которые этот трек определяют. В «Без трека» — доклады, которым трек в программе не назначен. Плашки тем под докладом открывают раздел темы.',
    thTalk: 'Доклад',
    thTrack: 'Трек',
    thTime: 'Время',
    cardClose: 'Закрыть карточку доклада',
    cardPrev: 'Предыдущий доклад',
    cardNext: 'Следующий доклад',
    cardTime: 'Время',
    cardHall: 'Зал',
    cardTrack: 'Трек',
    cardLectors: 'Лекторы',
    cardThemes: 'Темы',
    trackCaption: (name, n, k) => `Трек «${name}»: ${n} докладов${k > 0 ? `, тем — ${k}` : ''}.`,
    trackAria: (name) => `Мини-граф трека ${name}`,
    noLector: 'без лектора',
    themesH2: 'Темы',
    themesNote:
      'Темы — теги докладов, а не ступень иерархии: один доклад попадает в несколько тем, поэтому упоминаний тем ниже больше, чем докладов.',
    hallsDaysH2: 'Залы и дни',
    thHall: 'Зал',
    thDay: 'День',
    thDate: 'Дата',
    thTalks: 'Докладов',
    sourceNote: 'Источник программы —',
    generatorNote: 'генератор графа —',
  };
}

export const foundLabel = (copy: TalksCopy, n: number, total: number) =>
  copy.foundTemplate.replace('{n}', String(n)).replace('{total}', String(total));
