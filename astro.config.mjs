import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

// Per-URL `lastmod` for the sitemap. A single `lastmod: new Date()` stamps every
// URL as "changed today" on every deploy — the one form crawlers learn to ignore.
// Frontmatter is the only honest signal available at config time, so read it
// directly: content collections aren't reachable from this file.
// volta-parts carry no date field, so they stay out of the map — no lastmod
// beats a fabricated one.
const CONTENT_SOURCES = [
  ["src/content/posts", "posts"],
  ["src/content/posts-en", "en/posts"],
  ["src/content/projects", "projects"],
  ["src/content/projects-en", "en/projects"],
];

const lastmodByPath = new Map();
for (const [dir, prefix] of CONTENT_SOURCES) {
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".md") || file.startsWith("_")) continue;
    const frontmatter = fs.readFileSync(path.join(dir, file), "utf8").split("---")[1];
    if (!frontmatter) continue;
    const { date, updated } = parseYaml(frontmatter) ?? {};
    const stamp = updated ?? date;
    if (!stamp) continue;
    lastmodByPath.set(`/${prefix}/${file.replace(/\.md$/, "")}/`, new Date(stamp));
  }
}

// https://astro.build/config
export default defineConfig({
  site: "https://nikitaboyarkin.github.io",
  output: "static",
  trailingSlash: "ignore",
  // Prefetch linked pages so the next navigation is instant. `hover` keeps the
  // initial load free of extra requests; switch to `viewport` to also cover
  // touch devices at the cost of prefetching every link above the fold.
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
  // v7 default is 'jsx', which strips whitespace between inline elements;
  // keep the v5/v6 boolean behaviour to avoid layout regressions.
  compressHTML: true,
  i18n: {
    defaultLocale: "ru",
    locales: ["ru", "en"],
    routing: { prefixDefaultLocale: false },
  },
  build: {
    format: "directory",
  },
  // Deep-link redirects for the consolidated about-cluster (S1.2/S1.4).
  // Old routes collapse into /about anchors; /start becomes the in-page jump nav.
  redirects: {
    "/whois/": "/about/#who",
    "/work-with-me/": "/about/#work",
    "/now/": "/about/#now",
    "/start/": "/about/#start",
    "/en/whois/": "/en/about/#who",
    "/en/work-with-me/": "/en/about/#work",
    "/en/start/": "/en/about/#start",
    // S1.3 (PRD v6): /guides/ merged into the parameterised /notes/ route.
    "/guides/": "/notes/guides/",
    // 2026-09-19: the standalone /cv/ page became a PDF download button.
    "/cv/": "/CV-Nikita-Boyarkin.pdf",
  },
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: "ru",
        locales: { ru: "ru-RU", en: "en-US" },
      },
      changefreq: "weekly",
      priority: 0.7,
      // No top-level `lastmod`: it would override the per-URL value below.
      serialize: (item) => {
        const lastmod = lastmodByPath.get(new URL(item.url).pathname);
        return lastmod ? { ...item, lastmod } : item;
      },
      filter: (page) => !page.includes("/404/"),
    }),
  ],
});
