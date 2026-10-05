// Build-time llms.txt — single generator shared by /llms.txt and
// /.well-known/llms.txt (llmstxt.org canonical + well-known alias) so the two
// can never drift. Generated from the content collections, never hand-maintained.
import { getCollection } from "astro:content";
import { withBase } from "./path";

const slugOf = (id: string) => id.replace(/\.md$/, "");

/** Shelf notes carry no `description` — the body is the citable text. */
const blurb = (entry: { body?: string }): string =>
  (entry.body ?? "").replace(/\s+/g, " ").trim().slice(0, 200);

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

  add("## Core pages");
  add(`- [Home (RU)](${abs("")}): intro, featured project (${featuredProject?.data.title ?? "Product analytics"}), skill taxonomy.`);
  add(`- [Home (EN)](${abs("en/")}): English mirror.`);
  add(`- [About](${abs("about/")}): background and focus — who I am, how I work, what I enjoy, collaboration format, and the offers (hiring + collaboration) with quantified proof — A/B, retention, RFM, automation.`);
  add(`- [Writing](${abs("writing/")}): articles on SQL, A/B testing, retention, segmentation, automation.`);
  add(`- [Skill taxonomy](${abs("topics/")}): Junior/Middle/Senior topics with case studies per topic.`);
  add(`- [Glossary](${abs("glossary/")}): definitions of core analytics terms — p-value, MDE, SRM, cohort, LTV, RFM.`);
  add(`- [Knowledge graph](${abs("graph/")}): product-analytics domain map.`);
  add(`- [Games](${abs("games/")}): playable analytics arcade — 10 zero-dependency SVG mini-games (A/B test, funnel drop, cohort catch, SQL, retention, metric match) + arcade (snake, pong, 2048). Phone + desktop.`);
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

  add("## Contact");
  // No CV line: robots.txt disallows /CV-Nikita-Boyarkin.pdf for `User-agent: *`
  // as the site's one deliberate crawl exception, and llms.txt must not
  // advertise a URL we tell crawlers not to fetch. The CV stays discoverable to
  // humans through the nav and footer download buttons on every page.
  add("- GitHub: https://github.com/NikitaBoyarkin");
  add("- LinkedIn: https://www.linkedin.com/in/nikita-boyarkin");
  add("- Telegram: https://t.me/lofinibo");
  add();

  return lines.join("\n");
}
