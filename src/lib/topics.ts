// Single source of truth for the skill taxonomy. Shared by TopicMap.astro,
// topics/index.astro and topics/[tag].astro so none keep their own copies.
import { withBase } from "./path";

export type TopicLevel = "junior" | "middle" | "senior" | "meta";

export interface Topic {
  key: string;
  label: string;
  /** EN label for surfaces that render on `/en/`. Topic *pages* stay RU-only,
   *  so the link target is the same `/topics/<key>/` route in both locales. */
  labelEn: string;
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
  labelEn: string,
  level: TopicLevel,
  blurb: string,
  tags: string[],
): Topic {
  return { key, label, labelEn, level, blurb, tags, match: (t) => tags.includes(t) };
}

export const TOPICS: Topic[] = [
  topic("sql", "SQL", "SQL", "junior", "Запросы, оконные функции, агрегации — фундамент аналитика.", ["sql"]),
  topic("python", "Python", "Python", "junior", "pandas, NumPy, воспроизводимые пайплайны данных.", [
    "python",
    "pandas",
  ]),
  topic(
    "ab-testing",
    "A/B-тестирование",
    "A/B testing",
    "middle",
    "Методология экспериментов: дизайн, AA-тесты, поправки на множественные сравнения, байесовский вывод.",
    // `A/B-тест` and `A/B тест` normalise to the same key as the tag does, so a
    // project titled "A/B-тест" matches even though "ab-testing" never appears
    // as a literal substring of its title. `A/B Testing` covers the English
    // title the flagship project actually ships ("A/B Testing Methodology
    // Toolkit"), which the slug `ab` is too short to match on its own.
    ["ab-testing", "bayesian", "statistics", "A/B-тест", "A/B тест", "A/B Testing"],
  ),
  topic("retention", "Retention / когорты", "Retention / cohorts", "middle", "Когортный анализ, кривые retention, отток.", [
    "retention",
    "cohort-analysis",
  ]),
  topic(
    "segmentation",
    "Сегментация",
    "Segmentation",
    "middle",
    "RFM, поведенческие и денежные сегменты клиентов.",
    ["rfm", "segmentation", "customer-analytics"],
  ),
  topic(
    "automation",
    "Автоматизация",
    "Automation",
    "middle",
    "Telegram-боты, отчётность, оркестрация пайплайнов.",
    ["automation", "telegram", "reporting"],
  ),
  topic("career", "Карьера", "Career", "meta", "Портфолио, интервью, развитие data-аналитика.", [
    "career",
    "portfolio",
    "data-analyst",
  ]),
  topic(
    "causal-inference",
    "Causal-вывод",
    "Causal inference",
    "senior",
    "Причинность вне рамок A/B: feature impact, разность разностей, синтетический контроль.",
    ["causal-inference", "feature-impact", "causal"],
  ),
  topic(
    "metric-design",
    "Metric design",
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
export interface Countable {
  id: string;
  data: { tags?: string[]; tools?: string[]; title: string; description?: string };
}

/** True iff a post's tags place it in this topic. A post belongs to a topic at
 *  most once, however many of its canonical tags it carries. */
export function postMatchesTopic(topic: Topic, tags: string[] | undefined): boolean {
  return (tags ?? []).some((tag) => topic.match(tag));
}

/**
 * Fold a value into the one spelling both sides of project matching compare.
 *
 * Topic aliases are written with hyphens (`ab-testing`), titles with slashes
 * (`A/B-тест`), descriptions with prose spacing (`A/B testing`). Lowercasing
 * and collapsing `/`, the three dash variants and runs of whitespace into a
 * single space makes all of them the same string, so a project titled
 * "A/B-тест" matches the `ab-testing` topic instead of listing zero projects.
 */
export function normalizeTopicKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[/\-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalised aliases shorter than this are ignored: a two-character needle
 *  would match unrelated prose (e.g. "ab" inside "абсолютный"). */
const MIN_ALIAS_LENGTH = 3;

/**
 * True iff a project belongs to this topic.
 *
 * The signal is the project's slug/title/tools/description scanned for the
 * topic's canonical tags plus the topic key itself, both sides normalised with
 * `normalizeTopicKey` (hyphens, slashes and whitespace read as one separator).
 * Exported because the topic page renders its cards with this same predicate —
 * the hub count and the page list must never be computed by two different
 * rules.
 */
export function projectMatchesTopic(topic: Topic, project: Countable): boolean {
  const slug = project.id.replace(/\.mdx?$/, "");
  const hay = normalizeTopicKey(
    `${slug} ${project.data.title} ${(project.data.tools ?? []).join(" ")} ${project.data.description ?? ""}`,
  );
  const needles = [...topic.tags, topic.key]
    .map(normalizeTopicKey)
    .filter((needle) => needle.length >= MIN_ALIAS_LENGTH);
  return needles.some((needle) => hay.includes(needle));
}

/**
 * Compute one row per topic with the number of posts (via tag matching) plus
 * projects (via slug/title/tools/description signal matching). Topics with a
 * zero count are dropped; the rest are sorted by count desc.
 *
 * A post is counted **once per topic**, not once per matching tag: a post tagged
 * `ab-testing, bayesian, statistics` is one A/B-testing post, and counting its
 * three tags made the hub claim 9 when the topic page could only list 4.
 */
export function computeTopicRows(posts: Countable[], projects: Countable[]): TopicRow[] {
  const postCounts = new Map<string, number>(TOPICS.map((t) => [t.key, 0]));
  for (const post of posts) {
    for (const topic of TOPICS) {
      if (postMatchesTopic(topic, post.data.tags)) {
        postCounts.set(topic.key, (postCounts.get(topic.key) ?? 0) + 1);
      }
    }
  }

  const projectCounts = new Map<string, number>(TOPICS.map((t) => [t.key, 0]));
  for (const topic of TOPICS) {
    projectCounts.set(topic.key, projects.filter((p) => projectMatchesTopic(topic, p)).length);
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