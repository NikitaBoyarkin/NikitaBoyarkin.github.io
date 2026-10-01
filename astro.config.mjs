import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { satteri } from "@astrojs/markdown-satteri";
import fs from "node:fs";
import path from "node:path";
import githubDark from "shiki/themes/github-dark.mjs";
import { parse as parseYaml } from "yaml";
import { glossaryLinker } from "./src/lib/glossary-linker.ts";
import { katexMath } from "./src/lib/katex-math.ts";

// github-dark paints comments `#6a737d` — 3.05:1 on the theme's own `#24292e`
// code block, under WCAG AA; axe flags 5 color-contrast nodes on
// /posts/cohort-retention-guide/. GitHub's later revision of that same token is
// `#8b949e`, 4.77:1 on the same background, so exactly one token moves and
// nothing else does: the `#24292e` block the prose layer documents as
// deliberate, every other token colour, and the theme's name/type all stay
// byte-identical (asserted below).
//
// Done here rather than as a CSS override because Shiki writes the colour as an
// inline style on a bare `<span>` with no class — a stylesheet could only reach
// it through an attribute selector carrying a hex literal, and `prose.css` is
// bound by `tests/lib/prose-css.test.ts` to carry no hex at all.
const COMMENT_TOKENS = new Set([
  "comment",
  "punctuation.definition.comment",
  "string.comment",
]);
const shikiTheme = {
  ...githubDark,
  tokenColors: githubDark.tokenColors.map((rule) => {
    const scopes = Array.isArray(rule.scope) ? rule.scope : [rule.scope];
    if (!scopes.some((scope) => COMMENT_TOKENS.has(scope))) return rule;
    return { ...rule, settings: { ...rule.settings, foreground: "#8b949e" } };
  }),
};

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
  ["src/content/glossary", "glossary"],
  ["src/content/glossary-en", "en/glossary"],
];

const lastmodByPath = new Map();
for (const [dir, prefix] of CONTENT_SOURCES) {
  // Directories that don't exist yet (e.g. a not-yet-authored collection) must
  // not crash config evaluation — skip rather than let readdirSync throw.
  if (!fs.existsSync(dir)) continue;
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
  // Only the comment token differs from the stock github-dark theme — see the
  // derivation next to the import at the top of this file.
  markdown: {
    shikiConfig: { theme: shikiTheme },
    // Sätteri runs the mdast pipeline; @astrojs/markdown-remark is not installed,
    // so `markdown.remarkPlugins` would throw. The glossary linker is a no-op on
    // every file outside `src/content/glossary{, -en}`.
    // Order matters: math runs first so a term name inside `\text{…}` never gets
    // a markdown link injected into its LaTeX.
    processor: satteri({ mdastPlugins: [katexMath(), glossaryLinker()] }),
  },
  // Keep the OneWorks 3D hero out of the default page load.
  //
  // HeroAvatar.astro reaches the scene only via
  // `void import('../lib/avatar/mount-hero')` after an explicit opt-in click, yet
  // the built pages were downloading it anyway. Two rounds of chunking were
  // needed:
  //
  // 1. Rollup merged avatar modules with the *analytics* entry (they shared a
  //    helper), so `analytics.<hash>.js` statically imported `mount-hero.<hash>.js`
  //    (117 486 B raw / 32 811 B gzip). Splitting `src/lib/avatar/*` and
  //    `node_modules/@oneworks/*` into `avatar-3d` fixed that import.
  //
  // 2. But the shared helper that both entries imported is Vite's own
  //    `\0vite/preload-helper.js`, and Rollup parks a shared module in the
  //    largest chunk that needs it — the 1 MB avatar chunk. So every entry that
  //    preloads a lazy chunk statically imported `avatar-3d.<hash>.js` instead.
  //    Giving the preload helper its own tiny chunk removes the last static edge
  //    from the initial graph to the 3D scene.
  //
  // Verified by walking the static `from"./x.js"` edges of every script in
  // `dist/index.html`: `avatar-3d` is reachable only through the dynamic
  // `import("./avatar-3d...")` inside HeroAvatar, never on the default load.
  vite: {
    build: {
      rollupOptions: {
        output: {
          // `codeSplitting.groups` is rolldown's own chunking API (this build
          // runs on rolldown 1.2.6, not Rollup). `manualChunks` matched the
          // preload-helper id but rolldown ignored the assignment and still
          // parked the helper in the largest chunk that imported it.
          codeSplitting: {
            groups: [
              {
                name: "vite-preload",
                test: /vite[\\/]preload-helper/,
                priority: 20,
              },
              {
                name: "avatar-3d",
                test: /[\\/]src[\\/]lib[\\/]avatar[\\/]|[\\/]node_modules[\\/]@oneworks[\\/]/,
                priority: 10,
              },
            ],
          },
        },
      },
    },
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
