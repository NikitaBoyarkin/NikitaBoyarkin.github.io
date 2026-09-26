// Morph-icon wiring against the REAL built HTML (dist/). Every assertion here
// covers a failure that is invisible in review and silent at runtime:
//
//   1. Dropping `reducedMotion="user"` restores the library default ("never"),
//      which ignores the OS preference — an a11y regression no test would
//      otherwise catch, because the icons still morph.
//   2. Losing the SSR inner `<svg><path>` means the icon paints empty until the
//      custom element upgrades (flash of missing icon). The Astro shell exists
//      precisely to prevent that.
//   3. A rest-state `d` that no longer matches the toggle's `data-icon-*`
//      attribute (copy-paste between `from`/`to`) makes the icon jump on the
//      first hover instead of morphing from where it was drawn.
//   4. Dropping the `MorphIcon.astro` client chunk removes `defineMorphIcon()`:
//      the markup stays valid and nothing throws — the icons simply never move.
//
// Requires `bun run build` first.

import { describe, it, expect, beforeAll } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const DIST = resolve(__dirname, "../../dist");

interface MorphElement {
  /** Every attribute on <morph-icon>, as written. */
  attrs: Record<string, string>;
  /** `d` of the server-rendered inner <path>, or null when absent. */
  ssrD: string | null;
  /** Whether the shell hid the inner <svg> from assistive tech. The wrapper is
   *  `display: contents`, so the inner svg — not <morph-icon> — is what AT sees. */
  ssrAriaHidden: boolean;
  /** `role` on the inner <svg> ("img" when `label` was passed). */
  ssrRole: string | null;
  /** Whether the inner <svg> carries a <title>. */
  ssrTitled: boolean;
}

/** Parse `<morph-icon …>…</morph-icon>` without depending on attribute order —
 *  minification is free to reorder, so match the tag then split its attributes. */
function parseMorphIcons(html: string): MorphElement[] {
  const out: MorphElement[] = [];
  const tagRe = /<morph-icon\b([^>]*?)(\/?)>([\s\S]*?)<\/morph-icon>/g;
  for (const m of html.matchAll(tagRe)) {
    const attrs: Record<string, string> = {};
    for (const a of m[1].matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) {
      attrs[a[1].toLowerCase()] = a[2] ?? "";
    }
    const inner = m[3];
    const path = /<path\b[^>]*\bd="([^"]*)"/.exec(inner);
    const svg = /<svg\b([^>]*)>/.exec(inner);
    const svgAttrs: Record<string, string> = {};
    for (const a of (svg?.[1] ?? "").matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) {
      svgAttrs[a[1].toLowerCase()] = a[2] ?? "";
    }
    out.push({
      attrs,
      ssrD: path ? path[1] : null,
      ssrAriaHidden: svgAttrs["aria-hidden"] === "true",
      ssrRole: svgAttrs.role ?? null,
      ssrTitled: /<title>/.test(inner),
    });
  }
  return out;
}

/** The value of an attribute anywhere on the page (e.g. a toggle's rest-state
 *  `data-icon-menu`). Throws when absent — a missing data attribute is a
 *  finding, not a skip. */
function attrValue(html: string, name: string): string {
  const m = new RegExp(`${name}="([^"]*)"`).exec(html);
  if (!m) throw new Error(`no ${name} in built HTML`);
  return m[1];
}

function page(path: string): string {
  // `.${path}` — a leading slash would make resolve() absolute and drop DIST.
  const file = resolve(DIST, `.${path}`);
  if (!existsSync(file)) throw new Error(`dist${path} missing — run \`bun run build\` first`);
  return readFileSync(file, "utf8");
}

/** A page carrying all three Base.astro toggles (every page has them). */
const PAGES = [
  { label: "RU home", path: "/index.html", lang: "ru" },
  { label: "EN home", path: "/en/index.html", lang: "en" },
  { label: "RU 404", path: "/404.html", lang: "ru" },
];

/** Pages that render ArrowMorph inside ProjectCard. */
const ARROW_PAGES = [
  { label: "RU projects", path: "/projects/index.html" },
  { label: "EN projects", path: "/en/projects/index.html" },
];

/** Pages that render the AskMe widget. */
const ASKME_PAGES = [
  { label: "RU about", path: "/about/index.html" },
  { label: "EN about", path: "/en/about/index.html" },
];

// The client chunk that calls defineMorphIcon() for the Astro shell. Astro emits
// one per component; the hash rotates on every build, so match the stem only.
const SHELL_CHUNK = /_astro\/MorphIcon\.astro_astro_type_script_index_0_lang\.[\w-]+\.js/;
const ARROW_CHUNK = /_astro\/ArrowMorph\.astro_astro_type_script_index_0_lang\.[\w-]+\.js/;
const ASKME_CHUNK = /_astro\/AskMe\.astro_astro_type_script_index_0_lang\.[\w-]+\.js/;

describe("morph-icon contract (built HTML)", () => {
  beforeAll(() => {
    if (!existsSync(resolve(DIST, "index.html"))) {
      throw new Error("dist/ missing — run `bun run build` before this test");
    }
  });

  describe.each(PAGES)("every morph icon ($label)", ({ path }) => {
    let icons: MorphElement[] = [];
    let html = "";

    beforeAll(() => {
      html = page(path);
      icons = parseMorphIcons(html);
    });

    it("renders at least the three Base.astro toggles", () => {
      expect(icons.length).toBeGreaterThanOrEqual(3);
    });

    it("server-renders the resting path so nothing flashes before upgrade", () => {
      // The Astro shell exists to paint the final SVG on the server; the custom
      // element adopts it verbatim. A missing inner <path> = empty icon until JS.
      for (const icon of icons) {
        expect(icon.ssrD).not.toBeNull();
      }
    });

    it("keeps the SSR path identical to the element's resting icon", () => {
      // A drift between the two means the icon visibly snaps on hydration.
      for (const icon of icons) {
        expect(icon.ssrD).toBe(icon.attrs.icon);
      }
    });

    it("opts into the OS reduce-motion preference on every instance", () => {
      // The library default is "never" (ignores the setting). Omitting the prop
      // is the easy mistake and leaves the icons morphing for everyone.
      for (const icon of icons) {
        expect(icon.attrs["reduced-motion"]).toBe("user");
      }
    });

    it("declares a spring preset, not the implicit default", () => {
      for (const icon of icons) {
        expect(icon.attrs.spring).toBe("snappy");
      }
    });

    it("is either hidden from AT or explicitly labelled as an image", () => {
      // The wrapper is `display: contents`, so the inner <svg> is the node AT
      // sees: without `label` the shell must mark it aria-hidden, with `label`
      // it must become role="img" + <title>. Neither = an unnamed graphic.
      for (const icon of icons) {
        if (icon.attrs.label !== undefined) {
          expect(icon.ssrRole).toBe("img");
          expect(icon.ssrTitled).toBe(true);
          expect(icon.ssrAriaHidden).toBe(false);
        } else {
          // ArrowMorph also passes aria-hidden onto the wrapper; either node works.
          const hidden = icon.ssrAriaHidden || icon.attrs["aria-hidden"] === "true";
          expect(hidden).toBe(true);
        }
      }
    });

    it("ships the chunk that defines the custom element", () => {
      // Without defineMorphIcon() the markup stays valid and nothing throws —
      // the icons just never move. That is the whole failure mode.
      expect(html).toMatch(SHELL_CHUNK);
    });

    it("morphs from its drawn state, not into it", () => {
      // Each toggle paints its rest icon and animates to the alternate. If the
      // rendered `icon` no longer matches the button's rest-state attribute, the
      // first hover snaps instead of morphing.
      const nav = icons.find((i) => i.attrs.id === "nav-icon");
      const theme = icons.find((i) => i.attrs.id === "theme-icon");
      expect(nav?.attrs.icon).toBe(attrValue(html, "data-icon-menu"));
      expect(theme?.attrs.icon).toBe(attrValue(html, "data-icon-dark"));

      const search = icons.find((i) => i.attrs.id === "search-icon");
      expect(search?.attrs.icon).toBe(attrValue(html, "data-icon-search"));
    });

    it("has a distinct target endpoint for every toggle", () => {
      // Both endpoints equal = a morph of zero distance, i.e. no animation.
      expect(attrValue(html, "data-icon-close")).not.toBe(attrValue(html, "data-icon-menu"));
      expect(attrValue(html, "data-icon-light")).not.toBe(attrValue(html, "data-icon-dark"));
      expect(attrValue(html, "data-icon-cyber")).not.toBe(attrValue(html, "data-icon-dark"));
    });
  });

  describe.each(ARROW_PAGES)("arrow morphs ($label)", ({ path }) => {
    let arrows: MorphElement[] = [];
    let html = "";

    beforeAll(() => {
      html = page(path);
      arrows = parseMorphIcons(html).filter((i) => i.attrs["data-arrow"] !== undefined);
    });

    it("renders one per project-card action", () => {
      expect(arrows.length).toBeGreaterThan(0);
    });

    it("rests on the → the markup draws, then morphs to ↗", () => {
      for (const arrow of arrows) {
        expect(arrow.attrs.icon).toBe(arrow.attrs["data-from-d"]);
        expect(arrow.attrs["data-to-d"]).not.toBe(arrow.attrs["data-from-d"]);
      }
    });

    it("keeps both endpoints on the same 24×24 grid", () => {
      // A d string drawn off-grid would make morphicons scale the target into
      // the wrong place (the mismatch lands in sigma, not in an error).
      for (const arrow of arrows) {
        expect(arrow.attrs["data-from-d"]).toMatch(/^[\d\s.,MmLlHhVvCcSsQqTtAaZz-]+$/);
        expect(arrow.attrs["data-to-d"]).toMatch(/^[\d\s.,MmLlHhVvCcQtAaZz-]+$/);
      }
    });

    it("ships the arrow wiring chunk", () => {
      expect(html).toMatch(ARROW_CHUNK);
    });
  });

  describe.each(ASKME_PAGES)("ask-me toggle ($label)", ({ path }) => {
    let html = "";
    let icons: MorphElement[] = [];

    beforeAll(() => {
      html = page(path);
      icons = parseMorphIcons(html);
    });

    it("opens as a chat bubble and morphs to a close cross", () => {
      const icon = icons.find((i) => i.attrs.id === "askme-icon");
      expect(icon).toBeDefined();
      expect(icon?.attrs.icon).toBe(attrValue(html, "data-icon-chat"));
      expect(attrValue(html, "data-icon-close")).not.toBe(attrValue(html, "data-icon-chat"));
    });

    it("ships the toggle chunk", () => {
      expect(html).toMatch(ASKME_CHUNK);
    });
  });

  describe("payload (no morph code where there is no morph)", () => {
    it("keeps the arrow wiring off pages with no arrows", () => {
      // Astro splits the component script per page; a leak here means every
      // page pays for the wiring of a component it does not render.
      expect(page("/index.html")).not.toMatch(ARROW_CHUNK);
    });

    it("keeps the ask-me widget off pages with no panel", () => {
      expect(page("/index.html")).not.toMatch(ASKME_CHUNK);
    });
  });
});
