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

/** The value of `name` on the widget that owns `id="<iconId>"` — read as the
 *  nearest occurrence of the attribute BEFORE the icon element itself.
 *
 *  Several toggles reuse an attribute name: `data-icon-close` sits on both the
 *  mobile nav toggle and the search widget with an identical `d` string, so a
 *  page-global first-match reads the wrong button and can pass for the wrong
 *  reason. Anchoring the read to the icon that consumes the attribute reads the
 *  intended one. Throws when absent — a missing attribute is a finding, not a
 *  skip. */
function attrBefore(html: string, iconId: string, name: string): string {
  const at = html.indexOf(`id="${iconId}"`);
  if (at < 0) throw new Error(`no id="${iconId}" in built HTML`);
  let val: string | null = null;
  for (const hit of html.slice(0, at).matchAll(new RegExp(`${name}="([^"]*)"`, "g"))) {
    val = hit[1];
  }
  if (val === null) throw new Error(`no ${name} before #${iconId}`);
  return val;
}

function page(path: string): string {
  // `.${path}` — a leading slash would make resolve() absolute and drop DIST.
  const file = resolve(DIST, `.${path}`);
  if (!existsSync(file)) throw new Error(`dist${path} missing — run \`bun run build\` first`);
  return readFileSync(file, "utf8");
}

/** Chrome pages: the icons here are CSS-swapped, not morphed (2026-11-01). */
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

/** Concatenated CSS of every stylesheet a page links. */
function pageCss(html: string): string {
  const urls = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
  return urls
    .map((u) => {
      const file = resolve(DIST, `.${u}`);
      return existsSync(file) ? readFileSync(file, "utf8") : "";
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// The theme, drawer and search toggles used to be `morphicons` elements: the
// library's SVG-path parser (20 KB raw) executed at module evaluation on every
// page — twice, because `Base.astro` and `SearchBox.astro` both imported it.
// They are now plain SVGs plus three attribute selectors on state the DOM
// already carries (`data-theme` from the pre-paint boot script, `aria-expanded`
// flipped by each toggle). The morph stays where it is the interaction, not
// chrome: the arrows on project cards and the AskMe bubble.
// ---------------------------------------------------------------------------
describe("chrome icons are CSS-driven (no morph parser)", () => {
  describe.each(PAGES)("$label", ({ path }) => {
    const html = page(path);

    it("ships every state glyph and no <morph-icon>", () => {
      for (const cls of [
        "glyph-moon",
        "glyph-sun",
        "glyph-cyber",
        "glyph-menu",
        "glyph-close",
        "glyph-search",
        "glyph-x",
      ]) {
        expect(html, `missing .${cls}`).toContain(cls);
      }
      expect(html).not.toContain("<morph-icon");
    });

    it("keeps the morph parser out of the page bundle", () => {
      expect(html).not.toMatch(SHELL_CHUNK);
    });

    it("shows exactly one glyph per toggle state, and the rules are in the CSS", () => {
      const css = pageCss(html);
      // Default state: moon (dark is the default theme), menu, magnifier.
      expect(css).toMatch(/\.glyph\s*\{\s*display:\s*none/);
      expect(css).toMatch(/html\[data-theme=["']?light["']?\][^{]*\.glyph-sun[^{]*\{\s*display:\s*block/);
      expect(css).toMatch(
        /html\[data-theme=["']?cyberpunk["']?\][^{]*\.glyph-cyber[^{]*\{\s*display:\s*block/,
      );
      expect(css).toMatch(/#nav-toggle\[aria-expanded=["']?true["']?\][^{]*\.glyph-close[^{]*\{\s*display:\s*block/);
      expect(css).toMatch(
        /#search-toggle\[aria-expanded=["']?true["']?\][^{]*\.glyph-x[^{]*\{\s*display:\s*block/,
      );
    });

    it("keeps the drawer and search toggles accessible", () => {
      // The swap is visual; the control still needs a name and a state.
      expect(html).toMatch(/id="nav-toggle"[^>]*aria-expanded="false"/);
      expect(html).toMatch(/id="search-toggle"[^>]*aria-expanded="false"/);
      expect(html).toMatch(/id="theme-toggle"[^>]*aria-label="[^"]+"/);
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
        expect(arrow.attrs["data-to-d"]).toMatch(/^[\d\s.,MmLlHhVvCcSsQqTtAaZz-]+$/);
      }
    });

    it("names the new-tab arrows and keeps the internal one decorative", () => {
      // The ↗ sits on target="_blank" links: `label` turns it into role="img" +
      // <title>, so the link's accessible name says "opens in a new tab"
      // (WCAG 3.2.5). The internal "View project" arrow carries no label and
      // must stay hidden from AT.
      for (const arrow of arrows) {
        const labelled = arrow.attrs.label !== undefined;
        const hidden = arrow.ssrAriaHidden || arrow.attrs["aria-hidden"] === "true";
        if (labelled) {
          expect(arrow.ssrRole).toBe("img");
          expect(arrow.ssrTitled).toBe(true);
          // An aria-hidden on the wrapper would hide the <title> — the exact
          // regression that makes a "labelled" icon silent.
          expect(arrow.attrs["aria-hidden"]).not.toBe("true");
          expect(arrow.ssrAriaHidden).toBe(false);
        } else {
          expect(hidden).toBe(true);
        }
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
      expect(icon?.attrs.icon).toBe(attrBefore(html, "askme-icon", "data-icon-chat"));
      expect(attrBefore(html, "askme-icon", "data-icon-close")).not.toBe(
        attrBefore(html, "askme-icon", "data-icon-chat"),
      );
    });

    it("ships the toggle chunk", () => {
      expect(html).toMatch(ASKME_CHUNK);
    });
  });

  describe("labelled morph coverage", () => {
    it("exercises the role=img + <title> branch on at least one page", () => {
      // Guards F1: before this, no morph passed `label`, so the labelled branch
      // of the a11y contract was dead code — a silent regression in the shell's
      // label handling could not fail any test. If the new-tab arrows lose their
      // label, that branch goes dark again and this test fails.
      const labelled = ARROW_PAGES.flatMap(({ path }) =>
        parseMorphIcons(page(path)).filter((i) => i.attrs.label !== undefined),
      );
      expect(labelled.length).toBeGreaterThan(0);
      for (const icon of labelled) {
        expect(icon.ssrRole).toBe("img");
        expect(icon.ssrTitled).toBe(true);
        expect(icon.ssrAriaHidden).toBe(false);
      }
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

    it("keeps the morph parser off every page without an arrow or bubble", () => {
      // The homepage carries no morph-icon at all, so it must not ship the
      // parser; a future component importing `morphicons/astro` into Base or
      // SearchBox puts it back on 223 pages and fails here.
      expect(page("/index.html")).not.toMatch(SHELL_CHUNK);
      expect(page("/contact/index.html")).not.toMatch(SHELL_CHUNK);
    });
  });
});
