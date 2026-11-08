import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { projectRank, projectTracks } from "./projects";

/**
 * The /demos/ hub's data layer.
 *
 * Twenty-five standalone boards live under `public/demos/<slug>/index.html`.
 * They are copied verbatim by Astro, so nothing in `src/` knew they existed —
 * the only index they ever had was the dashboard card that linked 23 of them
 * one by one. This module is that index: it scans the directory, reads each
 * board's own `<title>` and `<meta name="description">`, and joins the result to
 * the project that already declares the board in its `demo:` frontmatter.
 *
 * Deliberate properties:
 *
 * 1. **Derived, never listed.** A board that lands on disk appears in the hub
 *    with no edit here. `demo-tokens` still keeps its own explicit slug list on
 *    purpose — that gate covers per-page colour literals and must not go quiet
 *    when a directory appears; this module covers the index, where a missing
 *    board is the failure.
 * 2. **The board's own copy wins.** Every hand-authored board already ships a
 *    Russian `<title>` and a 120–200-char description for search; repeating
 *    them by hand would create a second source that drifts from the page.
 * 3. **Pure Node, no `astro:content`.** The page passes project frontmatter in,
 *    so `bun test` can exercise the scan and the join without Astro.
 * 4. **`other` is a group, not a failure.** Three boards ship without a
 *    `demo:` pointer (`bayesian`, `trino-federation`, `volta-board`); two of
 *    them predate the project that explains them. `DEMO_CASE_OVERRIDES` is the
 *    explicit, reviewable place to say which case a board belongs to — the same
 *    "override map" rule the dashboard contract set for scanned artifacts.
 */

export const DEMO_DIR = "public/demos";
export const OTHER_GROUP_KEY = "other";

/**
 * Boards whose project frontmatter has no `demo:` pointer. Every value is a
 * project slug that exists in `src/content/projects/`; the join is asserted by
 * `tests/lib/demos.test.ts`, so a renamed project breaks the build instead of
 * silently losing the card.
 */
export const DEMO_CASE_OVERRIDES: Record<string, string> = {
  // Peeking / p-value vs Bayesian posterior is the A/B toolkit's own argument.
  bayesian: "ab",
  // The two DuckDB marts are the ClickHouse case's federation companions.
  "trino-federation": "clickhouse",
  // The declarative dbt-charts rendering of the Volta hub's own numbers.
  "volta-board": "volta",
};

/**
 * Boards that ship without a `<meta name="description">` (the build-generated
 * dbt-charts exports). A fallback sentence is written here rather than invented
 * in the card, so the claim is reviewable next to the slug it describes.
 */
export const DEMO_DESCRIPTION_OVERRIDES: Record<string, string> = {
  "trino-federation": "Две витрины DuckDB, соединённые одним federated-запросом Trino.",
};

const OTHER_LABELS = { ru: "Прочее", en: "Other" } as const;

/** A demo found on disk. `href` is site-relative and has NOT been through `withBase()`. */
export interface ScannedDemo {
  slug: string;
  title: string;
  description: string;
  href: string;
}

export interface DemoHead {
  title: string | null;
  description: string | null;
}

/** A project that declares (or is assigned) a board. */
export interface DemoCaseRef {
  slug: string;
  title: string;
  track: string;
}

/** The structural slice of a `projects` collection entry the join needs. */
export interface DemoProjectLike {
  id: string;
  data: { demo?: string | null; track: string; title: string };
}

/** One row of the hub: the scan joined to its case and track. */
export interface DemoEntry extends ScannedDemo {
  caseSlug: string | null;
  caseTitle: string | null;
  track: string | null;
}

export interface DemoGroup {
  key: string;
  label: string;
  demos: DemoEntry[];
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

function decodeEntities(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity);
}

/**
 * The board's own `<title>` and description. Attribute order is not fixed in
 * hand-authored HTML, so both orders are accepted; a board with neither yields
 * `null` rather than an empty string that renders as a blank card.
 */
export function parseDemoHead(html: string): DemoHead {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? null;
  const description =
    /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i.exec(html)?.[1] ??
    /<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i.exec(html)?.[1] ??
    null;

  return {
    title: title ? decodeEntities(title) : null,
    description: description ? decodeEntities(description.trim()) : null,
  };
}

/** A repository tail: lowercase kebab with at least one hyphen. */
const REPO_TAIL = /\s+—\s+[a-z0-9]+(?:-[a-z0-9]+)+$/;

/**
 * Some boards carry the repository name in their title
 * (`MRR, воронка и удержание — sql-analytics-case-study`). That tail is a slug,
 * not prose. The test is deliberately narrow: at least one hyphen and no
 * capitals, so a real subtitle survives — `PostHog: … — TaskFlow` and
 * `Посты, форматы и что из этого следует — LinkedIn` keep their product name.
 */
export function cleanDemoTitle(title: string): string {
  return title.replace(REPO_TAIL, "").trim();
}

/** Last-resort display title: `trino-federation` → `Trino Federation`. */
export function deriveTitle(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * `demos/sql/index.html` → `sql`. Only an in-repo board is joinable; an external
 * `demo:` (the two boards hosted on other GitHub Pages) yields `null`.
 */
export function demoSlugFromFrontmatter(demo: string | null | undefined): string | null {
  if (!demo) return null;
  const match = /^\s*demos\/([^/]+)\/(?:index\.html)?\s*$/i.exec(demo);
  return match ? match[1] : null;
}

/** Every directory under `root` that actually serves a board. */
export function scanDemos(root: string = DEMO_DIR): ScannedDemo[] {
  if (!existsSync(root)) return [];

  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .flatMap((entry) => {
      const slug = entry.name;
      const file = join(root, slug, "index.html");
      if (!existsSync(file)) return [];

      const head = parseDemoHead(readFileSync(file, "utf8"));
      return [
        {
          slug,
          title: cleanDemoTitle(head.title ?? deriveTitle(slug)),
          description: head.description ?? DEMO_DESCRIPTION_OVERRIDES[slug] ?? "",
          href: `demos/${slug}/`,
        },
      ];
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * Board slug → the case it belongs to. Overrides go first so they cover the
 * boards no project points at; frontmatter goes second, so the authored
 * source wins the moment a project gains its own `demo:` pointer and the
 * override can be retired without touching the board.
 */
export function demoCaseMap(
  projects: readonly DemoProjectLike[],
  overrides: Record<string, string> = DEMO_CASE_OVERRIDES,
): Record<string, DemoCaseRef> {
  const cases: Record<string, DemoCaseRef> = {};
  const bySlug = new Map(projects.map((project) => [project.id.replace(/\.md$/, ""), project]));

  const add = (demoSlug: string, projectSlug: string) => {
    const project = bySlug.get(projectSlug);
    if (!project) return;
    cases[demoSlug] = {
      slug: projectSlug,
      title: project.data.title,
      track: project.data.track,
    };
  };

  for (const [demoSlug, projectSlug] of Object.entries(overrides)) add(demoSlug, projectSlug);
  for (const project of projects) {
    const demoSlug = demoSlugFromFrontmatter(project.data.demo);
    if (demoSlug) add(demoSlug, project.id.replace(/\.md$/, ""));
  }

  return cases;
}

/** Join the scan to the cases; a board with no case keeps `null`, never a guess. */
export function attachCases(
  demos: readonly ScannedDemo[],
  cases: Record<string, DemoCaseRef>,
): DemoEntry[] {
  return demos.map((demo) => {
    const found = cases[demo.slug];
    return {
      ...demo,
      caseSlug: found?.slug ?? null,
      caseTitle: found?.title ?? null,
      track: found?.track ?? null,
    };
  });
}

/**
 * Tracks in the site's taxonomy order, then the boards that belong to none.
 * Within a track the portfolio's own `PROJECT_ORDER` wins, so the hub reads in
 * the same sequence as `/projects/`; unassigned boards sort by slug.
 */
export function groupDemos(demos: readonly DemoEntry[], lang: "ru" | "en" = "ru"): DemoGroup[] {
  const rank = (demo: DemoEntry) =>
    demo.caseSlug ? projectRank(demo.caseSlug) : Number.MAX_SAFE_INTEGER;
  const inGroup = (track: string | null) =>
    demos
      .filter((demo) => demo.track === track)
      .sort((a, b) => rank(a) - rank(b) || a.slug.localeCompare(b.slug));

  const groups = projectTracks(lang)
    .map(({ key, label }) => ({ key, label, demos: inGroup(key) }))
    .filter((group) => group.demos.length > 0);

  const other = inGroup(null);
  if (other.length) groups.push({ key: OTHER_GROUP_KEY, label: OTHER_LABELS[lang], demos: other });

  return groups;
}
