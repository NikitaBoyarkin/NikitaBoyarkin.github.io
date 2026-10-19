// Dashboard spine — the single source of type truth and the curation config for
// the homepage dashboard (`/` and `/en/`).
//
// Three readers share this module: the loader (`lib/dashboard-data.ts`), the
// surface component (`components/DashboardGrid.astro`) and the contract test
// (`tests/lib/dashboard.test.ts`). It is deliberately free of `astro:content`
// and of `node:fs`: the loader loads and the scanner scans, then hands plain
// data to `buildDashboard`, so the builder is testable with fixtures and safe to
// import from a client script.
//
// Reuse, never re-derive: project order (`lib/projects.ts`), topic rows
// (`lib/topics.ts`), shelf hrefs (`lib/library.ts`), base paths (`lib/path.ts`).
//
// What this module deliberately does NOT do: index content. `/explorer/` already
// is the exhaustive, filterable surface. This dashboard curates, and its one
// unique job is surfacing what no index can see — the standalone apps in
// `public/`, which the Astro sitemap integration does not route and
// `explorer-index.json` does not read.

import { withBase } from './path';

export type Lang = 'ru' | 'en';

/** The canonical card order. A superset: `EN` drops `topics`, see `sectionOrder`. */
export const SECTION_ORDER = [
  'projects',
  'volta',
  'writing',
  'glossary',
  'library',
  'topics',
  'tools',
  'about',
] as const;
export type SectionId = (typeof SECTION_ORDER)[number];

/** The six cards whose rows come from content collections. */
export type ContentSectionId = 'projects' | 'volta' | 'writing' | 'glossary' | 'library' | 'topics';

/** Rows a content card shows inline; the rest live behind `see all`. */
export const CHILDREN_LIMIT = 6;

export type ChildKind =
  | 'project'
  | 'volta'
  | 'post'
  | 'term'
  | 'source'
  | 'topic'
  | 'demo'
  | 'diagram'
  | 'game'
  | 'audit'
  | 'page';

export interface DashboardChild {
  title: string;
  href: string;
  kind: ChildKind;
  /** `true` for a `public/` artifact: the URL is not an Astro route, so the
   *  sitemap, `scripts/check_site.py` and the link crawler never see it. */
  external?: boolean;
  /** Set on an aggregating row — one link that stands for N artifacts (the
   *  arcade hub stands for its games; a topic row stands for its items). */
  count?: number;
}

export interface DashboardSection {
  id: SectionId;
  title: string;
  desc: string;
  /** Absent when the card has no index to point at. Only the tools card: both
   *  `public/demos/` and `public/diagrams/` have no hub page, so this dashboard
   *  is their first index and there is nothing for "see all" to mean. */
  href?: string;
  /** Computed from the sources, never authored. */
  count: number;
  /** Localized: «22 проекта», «23 демо · 20 диаграмм · 10 игр · 2 аудита». */
  countLabel: string;
  /** Rows. Clipped to `CHILDREN_LIMIT` only when `href` exists to take over. */
  children: DashboardChild[];
}

export interface DashboardSurface {
  key: 'explorer' | 'graph' | 'search' | 'notes';
  label: string;
  /** Absent for `search`: that chip is a button opening the existing island, not
   *  a URL. Every other surface is an anchor. */
  href?: string;
  hint?: string;
}

export interface DashboardMetric {
  value: string;
  label: string;
  href: string;
}

/** What the `public/` scan returns. See `lib/dashboard-scan.ts`. */
export interface ScannedArtifacts {
  demos: DashboardChild[];
  diagrams: DashboardChild[];
  /** One row: the arcade hub, `count` = number of games behind it. */
  games: DashboardChild[];
  audits: DashboardChild[];
}

export interface DashboardIndex {
  generatedAt: string;
  locale: Lang;
  sections: DashboardSection[];
  surfaces: DashboardSurface[];
  metrics: DashboardMetric[];
  meta: { generatedFrom: string[] };
}

export interface SectionInput {
  count: number;
  children: DashboardChild[];
}

export interface DashboardInput {
  locale: Lang;
  generatedAt: string;
  sections: Record<ContentSectionId, SectionInput>;
  scanned: ScannedArtifacts;
}

/** `en/` prefix for the EN tree; the RU tree is the root (`prefixDefaultLocale: false`). */
export function localePrefix(lang: Lang): string {
  return lang === 'en' ? 'en/' : '';
}

// ---------------------------------------------------------------------------
// Pluralisation — counts are printed with the right noun form, which is the
// difference between «22 проекта» and «22 проект».
// ---------------------------------------------------------------------------

export interface NounForms {
  /** 1 / 2–4 / 5+ — the Russian three-form pattern. */
  ru: readonly [string, string, string];
  en: readonly [string, string];
}

/**
 * The 11–14 exception is the one everyone gets wrong («11 проектов», not
 * «11 проект»), so it is spelled out rather than folded into the modulo.
 */
function ruNoun(n: number, [one, few, many]: readonly [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function noun(n: number, lang: Lang, forms: NounForms): string {
  if (lang === 'en') return n === 1 ? forms.en[0] : forms.en[1];
  return ruNoun(n, forms.ru);
}

export function countLabel(n: number, lang: Lang, forms: NounForms): string {
  return `${n} ${noun(n, lang, forms)}`;
}

export const NOUNS = {
  projects: { ru: ['проект', 'проекта', 'проектов'], en: ['project', 'projects'] },
  volta: { ru: ['модуль', 'модуля', 'модулей'], en: ['module', 'modules'] },
  writing: { ru: ['статья', 'статьи', 'статей'], en: ['post', 'posts'] },
  glossary: { ru: ['термин', 'термина', 'терминов'], en: ['term', 'terms'] },
  library: { ru: ['источник', 'источника', 'источников'], en: ['source', 'sources'] },
  topics: { ru: ['тема', 'темы', 'тем'], en: ['topic', 'topics'] },
  page: { ru: ['раздел', 'раздела', 'разделов'], en: ['page', 'pages'] },
  // The four `public/` artefact kinds. «демо» is indeclinable, which is exactly
  // why the breakdown is not built by string concatenation.
  demo: { ru: ['демо', 'демо', 'демо'], en: ['demo', 'demos'] },
  diagram: { ru: ['диаграмма', 'диаграммы', 'диаграмм'], en: ['diagram', 'diagrams'] },
  game: { ru: ['игра', 'игры', 'игр'], en: ['game', 'games'] },
  audit: { ru: ['аудит', 'аудита', 'аудитов'], en: ['audit', 'audits'] },
  // A compound agrees in the genitive plural: «2 интерактивных приложения».
  apps: {
    ru: ['интерактивное приложение', 'интерактивных приложения', 'интерактивных приложений'],
    en: ['interactive app', 'interactive apps'],
  },
} as const satisfies Record<string, NounForms>;

// ---------------------------------------------------------------------------
// Copy — Russian UI copy for the RU dashboard, English for the EN one, matching
// the site's convention (`design-plans/explorer-surface.md` §5).
// ---------------------------------------------------------------------------

export interface SectionCopy {
  title: string;
  desc: string;
}

export const DASHBOARD_COPY: Record<
  Lang,
  {
    heading: string;
    lead: string;
    surfacesTitle: string;
    metricsTitle: string;
    empty: string;
    seeAll: (n: number) => string;
    showAll: (n: number) => string;
    sections: Record<SectionId, SectionCopy>;
  }
> = {
  ru: {
    heading: 'Всё на сайте',
    lead: 'Проекты, статьи, словарь и демо — с честными счётчиками.',
    surfacesTitle: 'Разделы',
    metricsTitle: 'В цифрах',
    empty: 'Пока пусто.',
    seeAll: (n) => `Все ${n} →`,
    showAll: (n) => `Показать все ${n}`,
    sections: {
      projects: {
        title: 'Проекты',
        desc: 'Кейсы продуктовой аналитики: решение, действие, результат.',
      },
      volta: {
        title: 'Volta neobank',
        desc: 'Модули необанка: от эксперимента и воронки до юнит-экономики.',
      },
      writing: { title: 'Статьи', desc: 'Разборы методологии, симуляции и решений.' },
      glossary: { title: 'Словарь', desc: 'Термины продуктовой аналитики — от SRM до CUPED.' },
      library: { title: 'Библиотека', desc: 'Источники, на которых стоят методы.' },
      topics: { title: 'Темы', desc: 'Таксономия навыков: от SQL до metric design.' },
      tools: {
        title: 'Инструменты и демо',
        desc: 'Интерактивные приложения — открыть и потрогать.',
      },
      about: { title: 'Обо мне', desc: 'Кто это, CV и как связаться.' },
    },
  },
  en: {
    heading: 'Everything on the site',
    lead: 'Projects, posts, glossary and demos — with honest counters.',
    surfacesTitle: 'Sections',
    metricsTitle: 'In numbers',
    empty: 'Nothing here yet.',
    seeAll: (n) => `All ${n} →`,
    showAll: (n) => `Show all ${n}`,
    sections: {
      projects: {
        title: 'Projects',
        desc: 'Product analytics case studies: decision, action, result.',
      },
      volta: {
        title: 'Volta neobank',
        desc: 'Neobank modules: from experiments and funnels to unit economics.',
      },
      writing: { title: 'Writing', desc: 'Methodology, simulation and decision write-ups.' },
      glossary: { title: 'Glossary', desc: 'Product analytics terms — from SRM to CUPED.' },
      library: { title: 'Library', desc: 'The sources the methods rest on.' },
      topics: { title: 'Topics', desc: 'Skill taxonomy: from SQL to metric design.' },
      tools: {
        title: 'Tools & demos',
        desc: 'Interactive apps you can open and try.',
      },
      about: { title: 'About', desc: 'Who this is, the CV, and how to get in touch.' },
    },
  },
};

/**
 * Topics and `/notes/` are RU-only: `src/pages/topics/[tag].astro` reads `TOPICS`
 * and `notes/[...filter].astro` has no EN twin. The EN dashboard omits the card
 * rather than printing an EN count for a Russian page — the same locale honesty
 * `explorer-surface.md` §2 requires. (The nav still links an EN reader to the RU
 * topics index; that is pre-existing behaviour and out of scope here.)
 */
export function sectionOrder(lang: Lang): SectionId[] {
  return SECTION_ORDER.filter((id) => id !== 'topics' || lang === 'ru');
}

function sectionHref(id: ContentSectionId, lang: Lang): string {
  const p = localePrefix(lang);
  switch (id) {
    case 'projects':
      return withBase(`${p}projects/`);
    case 'volta':
      return withBase(`${p}projects/volta/`);
    case 'writing':
      return withBase(`${p}writing/`);
    case 'glossary':
      return withBase(`${p}glossary/`);
    case 'library':
      return withBase(`${p}library/`);
    case 'topics':
      return withBase('topics/');
  }
}

export function buildSurfaces(lang: Lang): DashboardSurface[] {
  const p = localePrefix(lang);
  const ru = lang === 'ru';
  const surfaces: DashboardSurface[] = [
    {
      key: 'explorer',
      label: ru ? 'Обозреватель' : 'Explorer',
      href: withBase(`${p}explorer/`),
    },
    {
      // No `hint`: in the 260px rail a prose hint wraps to a second line and the
      // pill stops reading as a pill. Measured, not guessed — `/explorer/` is
      // described by its own page and by the cards below.
      key: 'graph',
      label: ru ? 'Граф' : 'Graph',
      href: withBase(`${p}graph/`),
    },
    {
      // No href on purpose: this chip opens the existing `SearchBox` island.
      // With JS off it does nothing, and that breaks no entry point — every page
      // is still reachable through the cards, which are plain anchors.
      key: 'search',
      label: ru ? 'Поиск' : 'Search',
      hint: ru ? '/ или ⌘K' : '/ or ⌘K',
    },
  ];
  if (ru) {
    surfaces.push({
      key: 'notes',
      label: 'Заметки и гайды',
      href: withBase('notes/'),
      hint: 'RU',
    });
  }
  return surfaces;
}

// ---------------------------------------------------------------------------
// Builder — pure. Everything it prints is derived from `input`.
// ---------------------------------------------------------------------------

function gamesBehind(rows: DashboardChild[]): number {
  return rows.reduce((total, row) => total + (row.count ?? 1), 0);
}

/** The one card whose rows come from `public/`. */
function toolsSection(locale: Lang, scanned: ScannedArtifacts): DashboardSection {
  const demos = scanned.demos.length;
  const diagrams = scanned.diagrams.length;
  const games = gamesBehind(scanned.games);
  const audits = scanned.audits.length;
  const apps = demos + diagrams + games;
  const copy = DASHBOARD_COPY[locale].sections.tools;

  return {
    id: 'tools',
    title: copy.title,
    desc: copy.desc,
    // No href: `public/demos/` and `public/diagrams/` have no hub page, so this
    // card is the only index either has ever had. See `DashboardSection.href`.
    count: apps,
    // Each group is pluralised on its own number: «23 демо · 20 диаграмм ·
    // 10 игр · 2 аудита». Concatenating a single noun form would print
    // «2 диаграмм».
    countLabel: [
      `${demos} ${noun(demos, locale, NOUNS.demo)}`,
      `${diagrams} ${noun(diagrams, locale, NOUNS.diagram)}`,
      `${games} ${noun(games, locale, NOUNS.game)}`,
      `${audits} ${noun(audits, locale, NOUNS.audit)}`,
    ].join(' · '),
    // Never clipped: there is no index to fall back on, so a clipped row would be
    // an unreachable artefact. The card renders these inside a `<details>`.
    children: [...scanned.demos, ...scanned.games, ...scanned.diagrams, ...scanned.audits],
  };
}

function aboutSection(locale: Lang): DashboardSection {
  const p = localePrefix(locale);
  const ru = locale === 'ru';
  const copy = DASHBOARD_COPY[locale].sections.about;
  const children: DashboardChild[] = [
    { title: ru ? 'Обо мне' : 'About', href: withBase(`${p}about/`), kind: 'page' },
    { title: ru ? 'Связаться' : 'Contact', href: withBase(`${p}contact/`), kind: 'page' },
    {
      title: 'CV (PDF)',
      // Language-neutral: one PDF serves both locales.
      href: withBase('CV-Nikita-Boyarkin.pdf'),
      kind: 'page',
      external: true,
    },
  ];
  return {
    id: 'about',
    title: copy.title,
    desc: copy.desc,
    href: withBase(`${p}about/`),
    count: children.length,
    countLabel: countLabel(children.length, locale, NOUNS.page),
    children,
  };
}

function contentSection(
  id: ContentSectionId,
  locale: Lang,
  input: SectionInput,
): DashboardSection {
  const copy = DASHBOARD_COPY[locale].sections[id];
  return {
    id,
    title: copy.title,
    desc: copy.desc,
    href: sectionHref(id, locale),
    count: input.count,
    countLabel: countLabel(input.count, locale, NOUNS[id]),
    // Clipped: the section index holds the full list, and fewer rows keep the
    // JSON document small (the contract budgets it at 120 KB).
    children: input.children.slice(0, CHILDREN_LIMIT),
  };
}

function buildMetrics(
  locale: Lang,
  sections: Record<SectionId, DashboardSection>,
  scanned: ScannedArtifacts,
): DashboardMetric[] {
  const apps = scanned.demos.length + scanned.diagrams.length + gamesBehind(scanned.games);
  // The arcade hub is the only real index among the scanned artefacts, so it is
  // where the "apps" number sends a reader.
  const arcade = scanned.games[0]?.href ?? sections.tools.children[0]?.href;
  const metric = (n: number, forms: NounForms, href: string): DashboardMetric => ({
    value: String(n),
    label: noun(n, locale, forms),
    href,
  });
  const metrics: DashboardMetric[] = [
    metric(sections.projects.count, NOUNS.projects, sections.projects.href!),
    metric(sections.volta.count, NOUNS.volta, sections.volta.href!),
  ];
  // Advertised only when there is somewhere to send the reader: a metric whose
  // href points at nothing is worse than a missing metric, and an empty scan
  // means the card behind it is empty too.
  if (apps > 0 && arcade) metrics.push(metric(apps, NOUNS.apps, arcade));
  metrics.push(
    metric(sections.writing.count, NOUNS.writing, sections.writing.href!),
    metric(sections.glossary.count, NOUNS.glossary, sections.glossary.href!),
    metric(sections.library.count, NOUNS.library, sections.library.href!),
  );
  return metrics;
}

export function buildDashboard(input: DashboardInput): DashboardIndex {
  const { locale, generatedAt, sections: input4, scanned } = input;

  const content = Object.fromEntries(
    (Object.keys(input4) as ContentSectionId[]).map((id) => [
      id,
      contentSection(id, locale, input4[id]),
    ]),
  ) as Record<ContentSectionId, DashboardSection>;

  const ordered: Record<SectionId, DashboardSection> = {
    ...content,
    tools: toolsSection(locale, scanned),
    about: aboutSection(locale),
  };

  return {
    generatedAt,
    locale,
    sections: sectionOrder(locale).map((id) => ordered[id]),
    surfaces: buildSurfaces(locale),
    metrics: buildMetrics(locale, ordered, scanned),
    meta: {
      generatedFrom: [
        'src/content/{projects,volta-parts,posts,glossary,library}[-en]',
        'src/lib/topics.ts',
        'public/demos',
        'public/diagrams',
        'public/games',
        'public/repo-audit',
      ],
    },
  };
}
