/**
 * The site's ONE registry of top-level sections.
 *
 * Why this module exists: before it, the section list lived in four places that
 * had no reason to agree — the drawer array in `Base.astro`, the drawer contract
 * in `tests/built/homepage-gate.test.ts`, the "Core pages" lines in
 * `src/lib/llms-txt.ts`, and the trailing-slash cases in `Breadcrumbs.astro`.
 * Adding a section meant editing all of them and hoping. This is the authority
 * for: the drawer (`src/layouts/Base.astro`), `/navigation/` in both locales,
 * the per-section OG banner path and name (`sectionOgPath`, consumed by
 * `SectionCard.astro` and `scripts/generate-section-og.mjs`), and
 * `sectionForPath`, which resolves the current URL to the section whose banner
 * `Base.astro` emits.
 *
 * It is NOT the sitemap's source: `astro.config.mjs` builds the sitemap from
 * the pages Astro finds on disk and never imports this module. `Breadcrumbs.astro`
 * and `src/lib/llms-txt.ts` also still keep their own labels and page lines.
 *
 * Shape notes:
 *   - `href` is relative and locale-aware. `home` differs between locales
 *     (`/` vs `en/`); `topics` and `repo-audit` are RU-only route pairs, so both
 *     locales carry the same string — an EN visitor crosses to the one page that
 *     exists instead of landing on a 404.
 *   - `description` is one line, used verbatim as the card subtitle and the
 *     banner subtitle. It must fit two lines at 40px on a 1200x630 canvas.
 *   - `icon` is a NAME from `src/lib/icons.ts`, never a path.
 */
import type { IconName } from './icons';

export type SectionKey =
  | 'home'
  | 'navigation'
  | 'projects'
  | 'demos'
  | 'hire'
  | 'about'
  | 'glossary'
  | 'graph'
  | 'talks'
  | 'library'
  | 'writing'
  | 'explorer'
  | 'topics'
  | 'repo-audit';

export interface SectionDef {
  key: SectionKey;
  href: { ru: string; en: string };
  label: { ru: string; en: string };
  description: { ru: string; en: string };
  icon: IconName;
}

/** Drawer order. Personas (`/hire/*`) sit with the sections, not beside them. */
export const SECTIONS: readonly SectionDef[] = [
  {
    key: 'home',
    href: { ru: '/', en: 'en/' },
    label: { ru: 'Главная', en: 'Home' },
    description: {
      ru: 'Кто я и три версии портфолио под задачу читателя.',
      en: 'Who I am, and three versions of the portfolio for three readers.',
    },
    icon: 'home',
  },
  {
    key: 'navigation',
    href: { ru: 'navigation/', en: 'en/navigation/' },
    label: { ru: 'Навигация', en: 'Navigation' },
    description: {
      ru: 'Все разделы сайта одной сеткой: что где лежит.',
      en: 'Every section of the site in one grid: what lives where.',
    },
    // Reuses the existing 2x2 `grid` glyph: `/navigation/` is a grid of section
    // cards, and a second near-identical drawing would only drift from it.
    icon: 'grid',
  },
  {
    key: 'projects',
    href: { ru: 'projects/', en: 'en/projects/' },
    label: { ru: 'Проекты', en: 'Projects' },
    description: {
      ru: 'Каталог кейсов: A/B-тесты, retention, дашборды — четыре вида.',
      en: 'Case catalogue: A/B tests, retention, dashboards — four views.',
    },
    icon: 'projects',
  },
  {
    key: 'demos',
    href: { ru: 'demos/', en: 'en/demos/' },
    label: { ru: 'Демо', en: 'Demos' },
    description: {
      ru: 'Демо-доски с данными проектов: часть интерактивна, часть статична.',
      en: "Demo boards on each project's own data: some interactive, some static.",
    },
    icon: 'demos',
  },
  {
    key: 'hire',
    href: { ru: 'hire/', en: 'en/hire/' },
    label: { ru: 'Найм', en: 'Hire' },
    description: {
      ru: 'Три входа в портфолио: HR, менеджер, коллега.',
      en: 'Three ways in: HR, manager, colleague.',
    },
    icon: 'users',
  },
  {
    key: 'about',
    href: { ru: 'about/', en: 'en/about/' },
    label: { ru: 'Обо мне', en: 'About' },
    description: {
      ru: 'Опыт, стек, что сейчас в работе и как со мной сотрудничать.',
      en: 'Experience, stack, what I am working on, and how to collaborate.',
    },
    icon: 'about',
  },
  {
    key: 'glossary',
    href: { ru: 'glossary/', en: 'en/glossary/' },
    label: { ru: 'Словарь', en: 'Glossary' },
    description: {
      ru: 'Термины продуктовой аналитики: определения и связи между ними.',
      en: 'Product analytics terms: short definitions and their connections.',
    },
    icon: 'glossary',
  },
  {
    key: 'graph',
    href: { ru: 'graph/', en: 'en/graph/' },
    label: { ru: 'Граф', en: 'Graph' },
    description: {
      ru: 'Граф понятий: как A/B, retention и SQL собираются в петлю.',
      en: 'The concept graph: how A/B testing, retention and SQL compose.',
    },
    icon: 'graph',
  },
  {
    key: 'talks',
    href: { ru: 'talks/', en: 'en/talks/' },
    label: { ru: 'Граф докладов', en: 'Talks graph' },
    description: {
      ru: '91 доклад программы Матемаркетинг 2026 и связи между ними.',
      en: '91 talks of the Matemarketing 2026 programme, and how they connect.',
    },
    icon: 'talks',
  },
  {
    key: 'library',
    href: { ru: 'library/', en: 'en/library/' },
    label: { ru: 'Библиотека', en: 'Library' },
    description: {
      ru: 'Книги, курсы и статьи, на которых стоит методология.',
      en: 'The books, courses and papers the methodology stands on.',
    },
    icon: 'library',
  },
  {
    key: 'writing',
    href: { ru: 'writing/', en: 'en/writing/' },
    label: { ru: 'Статьи', en: 'Writing' },
    description: {
      ru: 'Статьи о метриках, экспериментах и работе с данными.',
      en: 'Articles on metrics, experiments and working with data.',
    },
    icon: 'writing',
  },
  {
    key: 'explorer',
    href: { ru: 'explorer/', en: 'en/explorer/' },
    label: { ru: 'Обозреватель', en: 'Explorer' },
    description: {
      ru: 'Проекты, статьи, словарь и полка в одном фильтруемом списке.',
      en: 'Projects, articles, glossary and shelf in one filterable list.',
    },
    icon: 'explorer',
  },
  // RU-only pair: no /en/topics/ exists, so both locales point at the one page.
  {
    key: 'topics',
    href: { ru: 'topics/', en: 'topics/' },
    label: { ru: 'Темы', en: 'Topics' },
    description: {
      ru: 'Тематические подборки: A/B, retention, сегментация, SQL, карьера.',
      en: 'Topic collections: A/B, retention, segmentation, SQL, career.',
    },
    icon: 'topics',
  },
  // RU-only pair, same reasoning as `topics`.
  {
    key: 'repo-audit',
    href: { ru: 'repo-audit/', en: 'repo-audit/' },
    label: { ru: 'Аудит репозиториев', en: 'Repo audit' },
    description: {
      ru: 'Разборы чужих репозиториев: что в них держится, а что ломается.',
      en: "Audits of other people's repositories: what holds, what breaks.",
    },
    icon: 'repo-audit',
  },
] as const;

/**
 * `public/` path of a section's OG banner; the generator writes exactly this.
 * The banner paints the label and description as text, so it is locale-specific:
 * an EN page would otherwise preview RU words in a social card.
 */
export const sectionOgPath = (key: SectionKey, lang: 'ru' | 'en' = 'ru') =>
  `/images/og/section-${key}${lang === 'en' ? '-en' : ''}.png`;

const stripSlashes = (path: string) => path.replace(/^\/+/, '').replace(/\/+$/, '');

/**
 * The section a URL belongs to, or `null` for a route outside the registry.
 *
 * Longest prefix wins, and `home` never wins by prefix: `/` is a prefix of
 * every URL, so it is only returned on an exact match. Both locales are
 * candidates — an EN visitor on `/en/projects/` must resolve to `projects`,
 * which is what makes one banner serve both twins.
 */
export function sectionForPath(pathname: string): SectionKey | null {
  const target = stripSlashes(pathname);
  let best: { key: SectionKey; length: number } | null = null;
  for (const section of SECTIONS) {
    for (const locale of ['ru', 'en'] as const) {
      const href = stripSlashes(section.href[locale]);
      const matches = href === '' ? target === '' : target === href || target.startsWith(`${href}/`);
      if (!matches) continue;
      if (!best || href.length > best.length) best = { key: section.key, length: href.length };
    }
  }
  return best?.key ?? null;
}
