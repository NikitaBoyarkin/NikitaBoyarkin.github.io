// The «Ссылаются сюда» / «Linked from» block has to exist on a page that the
// link index says has inbound links, and every href in it has to resolve to a
// built file. This is the end-to-end half of the link-index gate: the lib test
// proves the index is correct, this proves the page actually renders it.
//
// Requires `bun run build` first (reads dist/). The suite skips cleanly when
// dist/ is absent, but never skips the checks themselves once it is present.
import { describe, it, expect, beforeAll } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { buildLocaleIndex } from "../lib/content-fixture";
import type { LinkNode, Locale } from "../../src/lib/link-index";

const DIST = resolve(__dirname, "../../dist");

interface Problem {
  kind: "missing-block" | "empty-block" | "missing-target";
  href?: string;
}

/** The first `post-related` section whose aria-label is `label`, or null. */
function backlinksBlock(html: string, label: string): string | null {
  for (const match of html.matchAll(/<section class="post-related" aria-label="([^"]*)">([\s\S]*?)<\/section>/g)) {
    if (match[1] === label) return match[2];
  }
  return null;
}

/** Map an internal href to the file `dist/` would serve for it. */
function fileFor(href: string): string {
  const clean = href.split(/[?#]/)[0];
  const target = join(DIST, clean.replace(/^\//, ""));
  return extname(clean) ? target : join(target, "index.html");
}

/** Everything wrong with one page's backlink block. An absent block is a
 *  problem, never an "ok, nothing to check" — that is what made this kind of
 *  assertion vacuous in other pages. */
function problems(html: string, label: string): Problem[] {
  const block = backlinksBlock(html, label);
  if (block === null) return [{ kind: "missing-block" }];
  const hrefs = [...block.matchAll(/<a[^>]+href="([^"]+)"/g)].map((m) => m[1]);
  if (hrefs.length === 0) return [{ kind: "empty-block" }];
  return hrefs
    .filter((href) => !existsSync(fileFor(href)))
    .map((href) => ({ kind: "missing-target", href }));
}

const LABEL: Record<Locale, string> = { ru: "Ссылаются сюда", en: "Linked from" };

const pageFile = (path: string) => join(DIST, path.replace(/^\//, ""), "index.html");

/** A project/post page this locale publishes with at least one backlink. */
function pickPage(locale: Locale): LinkNode | undefined {
  const index = buildLocaleIndex(locale);
  return Object.values(index.nodes).find(
    (node) =>
      node.locale === locale &&
      (node.kind === "post" || node.kind === "project") &&
      (index.incoming[node.id] ?? []).length > 0 &&
      existsSync(pageFile(node.path)),
  );
}

// `describe.skip` keeps the file importable without a build; the checks below
// are all real once dist/ exists.
const suite = existsSync(DIST) ? describe : describe.skip;

suite("built backlink blocks", () => {
  let pages: Record<Locale, { node: LinkNode; html: string }>;

  beforeAll(() => {
    pages = {} as typeof pages;
    for (const locale of ["ru", "en"] as Locale[]) {
      const node = pickPage(locale);
      if (!node) throw new Error(`no ${locale} page with backlinks — run \`bun run build\` first`);
      pages[locale] = { node, html: readFileSync(pageFile(node.path), "utf8") };
    }
  });

  for (const locale of ["ru", "en"] as Locale[]) {
    it(`${locale}: renders the «${LABEL[locale]}» block with resolving links`, () => {
      const { node, html } = pages[locale];
      expect(problems(html, LABEL[locale]), `page ${node.path}`).toEqual([]);
      const block = backlinksBlock(html, LABEL[locale]);
      // The block exists and is non-empty — the assertion above would still
      // pass if `problems` treated an absent block as fine.
      expect(block).not.toBeNull();
      expect([...block!.matchAll(/<h2>([^<]*)<\/h2>/g)].map((m) => m[1])).toEqual([LABEL[locale]]);
    });
  }

  it("the gate can fail when the block is absent (mutation control)", () => {
    const { html } = pages.ru;
    const stripped = html.replace(
      /<section class="post-related" aria-label="Ссылаются сюда">[\s\S]*?<\/section>/,
      "",
    );
    expect(stripped).not.toBe(html);
    expect(problems(stripped, LABEL.ru)).toEqual([{ kind: "missing-block" }]);
  });

  it("the gate can fail when a backlink points at an unbuilt page (mutation control)", () => {
    const { html } = pages.ru;
    const broken = html.replace(
      /(<section class="post-related" aria-label="Ссылаются сюда">[\s\S]*?<a href=")[^"]+(")/,
      "$1/definitely-not-built/$2",
    );
    expect(broken).not.toBe(html);
    expect(problems(broken, LABEL.ru)).toEqual([
      { kind: "missing-target", href: "/definitely-not-built/" },
    ]);
  });
});
