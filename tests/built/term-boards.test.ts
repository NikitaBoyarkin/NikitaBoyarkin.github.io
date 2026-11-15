// A glossary term page carries two cross-reference blocks — «Связанные понятия»
// and «Упоминается в» — and both now render as the same board as «Смотрите
// также»: one column per kind, each card carrying the target's own one-line
// description. `tests/lib/glossary.test.ts` proves the helpers carry the brief;
// this proves the built page actually shows one on every card.
//
// Requires `bun run build` first (reads dist/). Skips cleanly without it.
import { describe, it, expect, beforeAll } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const DIST = resolve(__dirname, "../../dist");

const LABELS = {
  ru: { related: "Связанные понятия", back: "Упоминается в" },
  en: { related: "Related terms", back: "Mentioned in" },
} as const;

/** The first `post-related` section with this aria-label, minus its wrapper. */
function board(html: string, label: string): string | null {
  for (const match of html.matchAll(
    /<section class="post-related[^"]*" aria-label="([^"]*)"[^>]*>([\s\S]*?)<\/section>/g,
  )) {
    if (match[1] === label) return match[2];
  }
  return null;
}

/** Astro scopes styles by attribute, so these classes stay verbatim. */
const count = (block: string, cls: string) =>
  [...block.matchAll(new RegExp(`class="${cls}"`, "g"))].length;

interface Page {
  path: string;
  html: string;
  related: string;
  back: string;
}

/** First built term page in `dir` that renders both blocks. */
function pickPage(dir: string, labels: { related: string; back: string }): Page | null {
  const base = join(DIST, dir);
  if (!existsSync(base)) return null;
  for (const slug of readdirSync(base).sort()) {
    const path = join(base, slug, "index.html");
    if (!existsSync(path)) continue;
    const html = readFileSync(path, "utf8");
    const related = board(html, labels.related);
    const back = board(html, labels.back);
    if (related && back) return { path, html, related, back };
  }
  return null;
}

const suite = existsSync(DIST) ? describe : describe.skip;

suite("built term cross-reference boards", () => {
  const pages: Record<"ru" | "en", Page> = {} as Record<"ru" | "en", Page>;

  beforeAll(() => {
    for (const locale of ["ru", "en"] as const) {
      const page = pickPage(locale === "ru" ? "glossary" : "en/glossary", LABELS[locale]);
      if (!page) throw new Error(`no ${locale} term page with both blocks — run \`bun run build\` first`);
      pages[locale] = page;
    }
  });

  for (const locale of ["ru", "en"] as const) {
    it(`${locale}: «${LABELS[locale].related}» is a board, every card described`, () => {
      const { path, related } = pages[locale];
      expect(count(related, "related-board-card"), `page ${path}`).toBeGreaterThan(0);
      expect(count(related, "related-board-label"), `page ${path}`).toBeGreaterThan(0);
      expect(count(related, "related-board-line"), `page ${path}`).toBe(
        count(related, "related-board-card"),
      );
    });

    it(`${locale}: «${LABELS[locale].back}» is a board, every card described`, () => {
      const { path, back } = pages[locale];
      expect(count(back, "related-board-card"), `page ${path}`).toBeGreaterThan(0);
      expect(count(back, "related-board-line"), `page ${path}`).toBe(
        count(back, "related-board-card"),
      );
    });
  }

  it("the gate can fail when a block is absent (mutation control)", () => {
    const { html } = pages.ru;
    const stripped = html.replace(
      /<section class="post-related[^"]*" aria-label="Связанные понятия"[^>]*>[\s\S]*?<\/section>/,
      "",
    );
    expect(stripped).not.toBe(html);
    expect(board(stripped, LABELS.ru.related)).toBeNull();
  });

  it("the gate can fail when a card loses its description (mutation control)", () => {
    const { related } = pages.ru;
    const stripped = related.replace(/class="related-board-line"/, 'class="not-a-line"');
    expect(stripped).not.toBe(related);
    expect(count(stripped, "related-board-line")).toBeLessThan(
      count(stripped, "related-board-card"),
    );
  });
});
