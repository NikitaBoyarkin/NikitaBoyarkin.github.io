// Single source of truth for the skill taxonomy. Shared by TopicMap.astro,
// topics/index.astro and topics/[tag].astro so none keep their own copies.
import { withBase } from "./path";

export type TopicLevel = "junior" | "middle" | "senior" | "meta";

export interface Topic {
  key: string;
  label: string;
  level: TopicLevel;
  blurb: string;
  /** Canonical tag spellings for this topic — used for post matching and as
   *  keywords when scanning project slug/title/tools/description. */
  tags: string[];
  /** True iff the tag belongs to this topic. Derived from `tags`. */
  match: (tag: string) => boolean;
}

function topic(
  key: string,
  label: string,
  level: TopicLevel,
  blurb: string,
  tags: string[],
): Topic {
  return { key, label, level, blurb, tags, match: (t) => tags.includes(t) };
}

export const TOPICS: Topic[] = [
  topic("sql", "SQL", "junior", "Запросы, оконные функции, агрегации — фундамент аналитика.", ["sql"]),
  topic("python", "Python", "junior", "pandas, NumPy, воспроизводимые пайплайны данных.", [
    "python",
    "pandas",
  ]),
  topic(
    "ab-testing",
    "A/B-тестирование",
    "middle",
    "Методология экспериментов: дизайн, AA-тесты, поправки на множественные сравнения, байесовский вывод.",
    ["ab-testing", "bayesian", "statistics"],
  ),
  topic("retention", "Retention / когорты", "middle", "Когортный анализ, кривые retention, отток.", [
    "retention",
    "cohort-analysis",
  ]),
  topic(
    "segmentation",
    "Сегментация",
    "middle",
    "RFM, поведенческие и денежные сегменты клиентов.",
    ["rfm", "segmentation", "customer-analytics"],
  ),
  topic(
    "automation",
    "Автоматизация",
    "middle",
    "Telegram-боты, отчётность, оркестрация пайплайнов.",
    ["automation", "telegram", "reporting"],
  ),
  topic("career", "Карьера", "meta", "Портфолио, интервью, развитие data-аналитика.", [
    "career",
    "portfolio",
    "data-analyst",
  ]),
  topic(
    "causal-inference",
    "Causal-вывод",
    "senior",
    "Причинность вне рамок A/B: feature impact, разность разностей, синтетический контроль.",
    ["causal-inference", "feature-impact", "causal"],
  ),
  topic(
    "metric-design",
    "Metric design",
    "senior",
    "North Star, дерево метрик, конфликты метрик и закон Гудхарта.",
    ["metric-design", "north-star", "metrics", "goodhart"],
  ),
];

export interface TopicRow {
  key: string;
  label: string;
  level: TopicLevel;
  blurb: string;
  href: string;
  count: number;
}

// Minimal shape of a collection entry we depend on — decouples from astro:content
// types so this module stays portable and testable.
interface Countable {
  id: string;
  data: { tags?: string[]; tools?: string[]; title: string; description?: string };
}

/**
 * Compute one row per topic with the number of posts (via tag matching) plus
 * projects (via slug/title/tools/description signal matching). Topics with a
 * zero count are dropped; the rest are sorted by count desc.
 *
 * Ported verbatim from the duplicated logic that lived in TopicMap.astro and
 * topics/index.astro so behaviour is unchanged.
 */
export function computeTopicRows(posts: Countable[], projects: Countable[]): TopicRow[] {
  const postCounts = new Map<string, number>(TOPICS.map((t) => [t.key, 0]));
  for (const post of posts) {
    for (const tag of post.data.tags ?? []) {
      for (const topic of TOPICS) {
        if (topic.match(tag)) postCounts.set(topic.key, (postCounts.get(topic.key) ?? 0) + 1);
      }
    }
  }

  const projectCounts = new Map<string, number>(TOPICS.map((t) => [t.key, 0]));
  const projectSignals = projects.map((p) => ({
    slug: p.id.replace(/\.md$/, ""),
    title: p.data.title.toLowerCase(),
    tools: (p.data.tools ?? []).join(" ").toLowerCase(),
    desc: (p.data.description ?? "").toLowerCase(),
  }));
  for (const topic of TOPICS) {
    const needle = topic.key.replace("-", " ");
    const hits = projectSignals.filter(
      (p) =>
        p.slug.includes(needle) ||
        p.title.includes(needle) ||
        p.tools.includes(needle) ||
        p.desc.includes(needle),
    );
    projectCounts.set(topic.key, hits.length);
  }

  return TOPICS.map((t) => ({
    key: t.key,
    label: t.label,
    level: t.level,
    blurb: t.blurb,
    href: withBase(`topics/${t.key}/`),
    count: (postCounts.get(t.key) ?? 0) + (projectCounts.get(t.key) ?? 0),
  }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** Group rows by level, preserving the count-desc order within each group. */
export function groupRowsByLevel(rows: TopicRow[]): { level: TopicLevel; rows: TopicRow[] }[] {
  const order: TopicLevel[] = ["junior", "middle", "senior", "meta"];
  return order
    .map((level) => ({ level, rows: rows.filter((r) => r.level === level) }))
    .filter((g) => g.rows.length > 0);
}

export const LEVEL_LABELS: Record<TopicLevel, string> = {
  junior: "Junior",
  middle: "Middle",
  senior: "Senior",
  meta: "Развитие",
};