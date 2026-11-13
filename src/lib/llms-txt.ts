// Build-time llms.txt — single generator shared by /llms.txt and
// /.well-known/llms.txt (llmstxt.org canonical + well-known alias) so the two
// can never drift. Generated from the content collections, never hand-maintained.
import { getCollection } from "astro:content";
import { withBase } from "./path";

const slugOf = (id: string) => id.replace(/\.md$/, "");

const BLURB_LIMIT = 200;

/** Marks a blurb may be cut on. A full stop may shed more tail than a comma:
 *  ending a thought reads better than ending a phrase, and both beat a word. */
const SENTENCE_END = [". ", "! ", "? "] as const;
const CLAUSE_END = ["; ", ": ", ", ", " — "] as const;

/**
 * Truncate to `limit` characters on a boundary, never mid-word.
 *
 * `.slice(0, 200)` used to cut wherever the budget ran out, so library blurbs
 * shipped fragments like "множественн", "produc" and "+8.65%" — a half word
 * reads as a typo to both a human and a citation-extracting crawler. A break
 * is taken, in order of preference, at the last sentence stop (up to a quarter
 * of the budget is dropped for it), the last clause mark (an eighth), or the
 * last space. Every truncated blurb ends in exactly one ellipsis.
 */
const truncate = (text: string, limit = BLURB_LIMIT): string => {
  if (text.length <= limit) return text;
  // One character is held back so the ellipsis can never overflow `limit`.
  const head = text.slice(0, limit - 1);
  const sentence = Math.max(...SENTENCE_END.map((mark) => head.lastIndexOf(mark)));
  const clause = Math.max(...CLAUSE_END.map((mark) => head.lastIndexOf(mark)));
  const space = head.lastIndexOf(" ");
  const cut =
    sentence >= limit * 0.75
      ? sentence
      : clause >= limit * 0.875
        ? clause
        : space > 0
          ? space
          : head.length;
  return `${head.slice(0, cut).trimEnd()}…`;
};

/** Shelf notes carry no `description` — the body is the citable text. */
const blurb = (entry: { body?: string }): string =>
  truncate((entry.body ?? "").replace(/\s+/g, " ").trim());

export async function buildLlmsTxt(site: string): Promise<string> {
  const abs = (path: string) => `${site}${withBase(path)}`;

  const [
    projects,
    projectsEn,
    posts,
    postsEn,
    voltaParts,
    glossaryTerms,
    glossaryTermsEn,
    shelfRu,
    shelfEn,
  ] = await Promise.all([
    getCollection("projects", (p) => !p.data.draft),
    getCollection("projects-en", (p) => !p.data.draft),
    getCollection("posts", (p) => !p.data.draft),
    getCollection("posts-en", (p) => !p.data.draft),
    getCollection("volta-parts", (p) => !p.data.draft),
    getCollection("glossary", (p) => !p.data.draft),
    getCollection("glossary-en", (p) => !p.data.draft),
    getCollection("library", (p) => !p.data.draft),
    getCollection("library-en", (p) => !p.data.draft),
  ]);

  const projectsSorted = [...projects].sort((a, b) =>
    a.data.title.localeCompare(b.data.title, "ru"),
  );
  const projectsEnSorted = [...projectsEn].sort((a, b) =>
    a.data.title.localeCompare(b.data.title, "en"),
  );
  const postsSorted = [...posts].sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
  const postsEnSorted = [...postsEn].sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
  const partsSorted = [...voltaParts].sort((a, b) => a.data.order - b.data.order);
  const glossarySorted = [...glossaryTerms].sort((a, b) =>
    a.data.title.localeCompare(b.data.title, "ru"),
  );
  const glossaryEnSorted = [...glossaryTermsEn].sort((a, b) =>
    a.data.title.localeCompare(b.data.title, "en"),
  );
  const shelfSorted = [...shelfRu].sort((a, b) => a.data.order - b.data.order);
  const shelfEnSorted = [...shelfEn].sort((a, b) => a.data.order - b.data.order);

  const featuredProject =
    projectsSorted.find((p) => slugOf(p.id) === "volta") ?? projectsSorted[0];

  const lines: string[] = [];
  const add = (s = "") => lines.push(s);

  add("# Nikita Boyarkin — Data Analyst / Product Analyst");
  add();
  add(
    "> Portfolio of Nikita Boyarkin: SQL, Python, A/B testing, retention, segmentation. " +
      "Case studies with reproducible methodology (CUPED, AA-tests, ship-gates) and a " +
      "skill taxonomy. Russian (default) + English.",
  );
  add();

  // Every route that carries content, not just the ones a sitemap would list.
  // Bilingual pages get one line per locale; `/topics/`, `/repo-audit/`,
  // `/notes*` and `/games/` are RU-only (no `/en/` twin is built), so they
  // carry a `(RU)` marker and no invented EN URL.
  add("## Core pages");
  add(`- [Home (RU)](${abs("")}): intro, featured project (${featuredProject?.data.title ?? "Product analytics"}), skill taxonomy.`);
  add(`- [Home (EN)](${abs("en/")}): English mirror.`);
  add(`- [About (RU)](${abs("about/")}): background and focus — who I am, how I work, what I enjoy, collaboration format, and the offers (hiring + collaboration) with quantified proof — A/B, retention, RFM, automation.`);
  add(`- [About (EN)](${abs("en/about/")}): English mirror of the background and focus page.`);
  add(`- [Projects (RU)](${abs("projects/")}): case catalogue — A/B tests, retention, dashboards, four views.`);
  add(`- [Projects (EN)](${abs("en/projects/")}): the English case catalogue.`);
  add(`- [Notes (RU)](${abs("notes/")}): short notes and decision logs — why a decision was made and what came of it.`);
  add(`- [Guides (RU)](${abs("notes/guides/")}): evergreen guides on product analytics — cohort analysis, RFM segmentation, SQL, experiment statistics.`);
  add(`- [Writing (RU)](${abs("writing/")}): articles on SQL, A/B testing, retention, segmentation, automation.`);
  add(`- [Writing (EN)](${abs("en/writing/")}): the same articles in English.`);
  add(`- [Skill taxonomy (RU)](${abs("topics/")}): Junior/Middle/Senior topics with case studies per topic.`);
  add(`- [Repo audit (RU)](${abs("repo-audit/")}): audits of other people's repositories — what holds, what breaks.`);
  add(`- [Glossary (RU)](${abs("glossary/")}): definitions of core analytics terms — p-value, MDE, SRM, cohort, LTV, RFM.`);
  add(`- [Glossary (EN)](${abs("en/glossary/")}): the same terms defined in English.`);
  add(`- [Knowledge graph (RU)](${abs("graph/")}): product-analytics domain map.`);
  add(`- [Knowledge graph (EN)](${abs("en/graph/")}): English domain map.`);
  add(`- [Talks graph (RU)](${abs("talks/")}): 91 talks of the Matemarketing 2026 programme and the links between them.`);
  add(`- [Talks graph (EN)](${abs("en/talks/")}): the English talks graph.`);
  add(`- [Library (RU)](${abs("library/")}): the books, courses and papers the methodology stands on.`);
  add(`- [Library (EN)](${abs("en/library/")}): the English shelf index.`);
  add(`- [Explorer (RU)](${abs("explorer/")}): every project, article, glossary term, library source, Volta module and topic in one filterable list — with addressable filters and a relation panel.`);
  add(`- [Explorer (EN)](${abs("en/explorer/")}): the English content explorer.`);
  add(`- [Navigation (RU)](${abs("navigation/")}): every section of the site in one grid.`);
  add(`- [Navigation (EN)](${abs("en/navigation/")}): the English section index.`);
  add(`- [Hiring (RU)](${abs("hire/")}): three ways in — HR screening, manager impact, colleague method.`);
  add(`- [Hiring (EN)](${abs("en/hire/")}): the English hiring hub.`);
  add(`- [Contact (RU)](${abs("contact/")}): how to reach me.`);
  add(`- [Contact (EN)](${abs("en/contact/")}): English contact page.`);
  add(`- [Games (RU)](${abs("games/")}): playable analytics arcade — 10 zero-dependency SVG mini-games (A/B test, funnel drop, cohort catch, SQL, retention, metric match) + arcade (snake, pong, 2048). Phone + desktop.`);
  add(`- [Demos (RU)](${abs("demos/")}): every demo board in one index — A/B, cohorts, RFM, churn, SQL, dashboards.`);
  add(`- [Demos (EN)](${abs("en/demos/")}): the same index with English chrome; the boards themselves are in Russian.`);
  add();

  add("## Featured project");
  const volta = projectsSorted.find((p) => slugOf(p.id) === "volta");
  if (volta) {
    add(`- [${volta.data.title}](${abs(`projects/${slugOf(volta.id)}/`)}): ${volta.data.description}`);
    add();
    add("### Volta modules");
    for (const part of partsSorted) {
      add(`- [${part.data.title}](${abs(`projects/volta/${slugOf(part.id)}/`)}): ${part.data.description}`);
    }
    add();
  }

  add("## Projects");
  for (const p of projectsSorted) {
    add(`- [${p.data.title}](${abs(`projects/${slugOf(p.id)}/`)}): ${p.data.description}`);
  }
  add();

  add("## Writing");
  for (const post of postsSorted) {
    add(`- [${post.data.title}](${abs(`posts/${slugOf(post.id)}/`)}): ${post.data.excerpt}`);
  }
  add();

  if (glossarySorted.length) {
    add("## Glossary");
    for (const term of glossarySorted) {
      add(`- [${term.data.title}](${abs(`glossary/${slugOf(term.id)}/`)}): ${term.data.description}`);
    }
    add();
  }

  if (shelfSorted.length) {
    add("## Library");
    for (const source of shelfSorted) {
      add(
        `- [${source.data.title}](${abs(`library/${slugOf(source.id)}/`)}): ${source.data.author} — ${blurb(source)}`,
      );
    }
    add();
  }

  if (projectsEnSorted.length || postsEnSorted.length || glossaryEnSorted.length || shelfEnSorted.length) {
    add("## English");
    if (projectsEnSorted.length) {
      add();
      add("### Projects (EN)");
      for (const p of projectsEnSorted) {
        add(`- [${p.data.title}](${abs(`en/projects/${slugOf(p.id)}/`)}): ${p.data.description}`);
      }
    }
    if (postsEnSorted.length) {
      add();
      add("### Writing (EN)");
      for (const post of postsEnSorted) {
        add(`- [${post.data.title}](${abs(`en/posts/${slugOf(post.id)}/`)}): ${post.data.excerpt}`);
      }
    }
    if (glossaryEnSorted.length) {
      add();
      add("### Glossary (EN)");
      for (const term of glossaryEnSorted) {
        add(`- [${term.data.title}](${abs(`en/glossary/${slugOf(term.id)}/`)}): ${term.data.description}`);
      }
    }
    if (shelfEnSorted.length) {
      add();
      add("### Library (EN)");
      for (const source of shelfEnSorted) {
        add(
          `- [${source.data.title}](${abs(`en/library/${slugOf(source.id)}/`)}): ${source.data.author} — ${blurb(source)}`,
        );
      }
    }
    add();
  }

  // The JSON/XML surfaces a crawler can fetch directly instead of scraping
  // HTML. Only files the build actually emits — nothing aspirational here.
  add("## Machine-readable data");
  add(`- [RSS (RU)](${abs("rss.xml")}): Russian posts feed — title, date, excerpt, link per item.`);
  add(`- [RSS (EN)](${abs("en/rss.xml")}): English posts feed, same shape.`);
  add(`- [Search index](${abs("search-index.json")}): one record per page — type, locale, title, description, tags, tools, href, date.`);
  add(`- [Explorer index](${abs("explorer-index.json")}): the full catalog behind /explorer/ — records, facets and the relations between them.`);
  add(`- [Knowledge graph (RU)](${abs("graph.json")}): the Russian content graph as {nodes, links} — pages as nodes, wikilinks and cross-references as edges.`);
  add(`- [Knowledge graph (EN)](${abs("graph-en.json")}): the English content graph, same shape.`);
  add(`- [Projects registry](${abs("projects.json")}): project metadata — slug, track, RU/EN title and description, result, tools, repo, demo, href — plus the Volta case list.`);
  add();

  add("## Contact");
  add("- GitHub: https://github.com/NikitaBoyarkin");
  add("- LinkedIn: https://www.linkedin.com/in/nikita-boyarkin");
  add("- Telegram: https://t.me/lofinibo");
  add();

  return lines.join("\n");
}
