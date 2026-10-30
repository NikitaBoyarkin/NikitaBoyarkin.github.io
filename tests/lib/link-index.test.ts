// Directed link index against the REAL content collections (see
// `content-fixture.ts`). The index is the backlinks mechanism, so the gates it
// feeds must be able to fail: each invariant below is paired with a mutation
// case that proves the check is not vacuous.
//
// Why the gates are worth having at all: `buildGraph` collapses direction and
// silently drops unresolved targets. This index keeps both, so "no orphan" and
// "no dangling link" are claims with a mechanism behind them — a broken
// frontmatter `related:` or a renamed slug turns this red.
import { describe, it, expect, beforeAll } from "bun:test";
import {
  buildLinkIndex,
  pairStats,
  slugOf,
  type LinkEntry,
  type LinkIndex,
  type Locale,
  type LinkNode,
} from "../../src/lib/link-index";
import { buildLocaleIndex, loadLocaleEntries } from "./content-fixture";

let indexes: Record<Locale, LinkIndex>;
let entries: Record<Locale, LinkEntry[]>;

beforeAll(() => {
  indexes = { ru: buildLocaleIndex("ru"), en: buildLocaleIndex("en") };
  entries = { ru: loadLocaleEntries("ru"), en: loadLocaleEntries("en") };
});

const byLocale = (title: string, check: (locale: Locale, index: LinkIndex) => void) => {
  describe(title, () => {
    for (const locale of ["ru", "en"] as Locale[]) {
      it(`${locale}`, () => check(locale, indexes[locale]));
    }
  });
};

/** `collection/slug` → node id, for mapping a `LinkRef` back to its entry.
 *  The slug is read from the path because the id carries the locale suffix. */
function idMap(index: LinkIndex): Map<string, string> {
  const map = new Map<string, string>();
  for (const node of Object.values(index.nodes)) {
    const slug = node.path.split("/").filter(Boolean).pop()!;
    map.set(`${node.collection}/${slug}`, node.id);
  }
  return map;
}

/** Node ids of entries whose link fields are the only way `targetId` is reached. */
function referrerIds(index: LinkIndex, targetId: string): Set<string> {
  return new Set((index.incoming[targetId] ?? []).map((ref) => ref.id));
}

/** Rebuild `source` with every field that can create an edge stripped from the
 *  given entries — the mutation that must make a connected node an orphan. */
function withoutLinksFrom(source: LinkEntry[], doomed: Set<string>, index: LinkIndex): LinkEntry[] {
  const ids = idMap(index);
  return source.map((entry) => {
    const id = ids.get(`${entry.collection}/${slugOf(entry.id)}`);
    if (!id || !doomed.has(id)) return entry;
    return { ...entry, related: [], children: [], sources: [], body: "" };
  });
}

const contentNode = (node: LinkNode) =>
  node.kind === "project" || node.kind === "post" || node.kind === "glossary" ||
  node.kind === "part" || node.kind === "library";

// --- invariants ------------------------------------------------------------

byLocale("has no orphan node", (locale, index) => {
  const orphans = index.orphans;
  expect(
    orphans,
    `${locale}: orphan nodes (no incoming link): ${orphans.join(", ")}`,
  ).toEqual([]);
});

byLocale("resolves every authored link", (locale, index) => {
  const rows = index.unresolved.map((u) => `${u.from} | ${u.raw} | ${u.reason}`);
  expect(rows, `${locale}: unresolved links\n${rows.join("\n")}`).toEqual([]);
});

// --- the gates can fail ----------------------------------------------------

describe("the gates can fail (mutation control)", () => {
  it("reports a node as an orphan once its incoming links are removed", () => {
    const index = indexes.ru;
    const source = entries.ru;
    // Any own-locale content node that currently has an inbound edge.
    const target = Object.values(index.nodes).find(
      (node) =>
        node.locale === "ru" &&
        contentNode(node) &&
        (index.incoming[node.id] ?? []).length > 0,
    );
    expect(target, "no RU node with an inbound edge to mutate").toBeDefined();

    const doomed = referrerIds(index, target!.id);
    expect(doomed.size).toBeGreaterThan(0);

    const mutated = buildLinkIndex({
      locale: "ru",
      entries: withoutLinksFrom(source, doomed, index),
    });

    expect(mutated.incoming[target!.id] ?? []).toEqual([]);
    expect(mutated.orphans).toContain(target!.id);
  });

  it("reports a missing target once a valid related path is renamed", () => {
    const index = indexes.ru;
    const target = Object.values(index.nodes).find(
      (node) => node.kind === "project" && node.locale === "ru",
    );
    expect(target, "no RU project to point at").toBeDefined();

    const probe: LinkEntry = {
      id: "__mutation__.md",
      collection: "projects",
      title: "Mutation probe",
      related: [`/projects/${slugOf(target!.id)}-missing/`],
      body: "",
    };
    const mutated = buildLinkIndex({ locale: "ru", entries: [probe] });
    expect(mutated.unresolved).toEqual([
      { from: "p:__mutation__", raw: probe.related![0], reason: "missing" },
    ]);
  });
});

// --- reciprocity ratchet ---------------------------------------------------

// Measured on 2026-10-31 against the real collections:
//   ru — 296 reciprocal / 1014 pairs = 0.2919
//   en — 292 reciprocal /  975 pairs = 0.2995
// Threshold sits ~0.02 below each measurement. It is a ratchet, not a target:
// new content may add non-reciprocal links, but the authored graph may not
// decay into a star of one-way links.
const RECIPROCITY_FLOOR: Record<Locale, number> = { ru: 0.27, en: 0.27 };

byLocale("keeps the authored graph reciprocal", (locale, index) => {
  const { pairs, reciprocal } = pairStats(index);
  expect(pairs).toBeGreaterThan(0);
  const ratio = reciprocal / pairs;
  expect(
    ratio,
    `${locale}: ${reciprocal}/${pairs} = ${ratio.toFixed(4)} (floor ${RECIPROCITY_FLOOR[locale]})`,
  ).toBeGreaterThanOrEqual(RECIPROCITY_FLOOR[locale]);
});

// --- Volta part resolution -------------------------------------------------

describe("Volta part paths resolve to part nodes", () => {
  const part = (locale: Locale) => {
    const entry = loadLocaleEntries(locale).find(
      (e) => e.collection === (locale === "en" ? "volta-parts-en" : "volta-parts"),
    );
    expect(entry, `no ${locale} volta part`).toBeDefined();
    return slugOf(entry!.id);
  };

  it("resolves /projects/volta/<part>/ to vp:", () => {
    const slug = part("ru");
    const entries: LinkEntry[] = [
      { id: "probe.md", collection: "projects", title: "Probe", related: [`/projects/volta/${slug}/`], body: "" },
      { id: `${slug}.md`, collection: "volta-parts", title: "Part", body: "" },
    ];
    const index = buildLinkIndex({ locale: "ru", entries });
    expect(index.outgoing["p:probe"]?.map((ref) => ref.id)).toContain(`vp:${slug}`);
    expect(index.unresolved).toEqual([]);
  });

  it("resolves the EN variant /en/projects/volta/<part>/ to vp:@en", () => {
    const slug = part("en");
    const entries: LinkEntry[] = [
      { id: "probe.md", collection: "projects-en", title: "Probe", related: [`/en/projects/volta/${slug}/`], body: "" },
      { id: `${slug}.md`, collection: "volta-parts-en", title: "Part", body: "" },
    ];
    const index = buildLinkIndex({ locale: "en", entries });
    expect(index.outgoing["p:probe@en"]?.map((ref) => ref.id)).toContain(`vp:${slug}@en`);
  });

  it("reports a missing glossary target as `missing`, not `unparsable`", () => {
    const entries: LinkEntry[] = [
      { id: "probe.md", collection: "projects", title: "Probe", related: ["/glossary/nope/"], body: "" },
    ];
    const index = buildLinkIndex({ locale: "ru", entries });
    expect(index.unresolved).toEqual([
      { from: "p:probe", raw: "/glossary/nope/", reason: "missing" },
    ]);
  });
});

// Guard against a future refactor that drops the fallback collections: the
// index must still be built from both locales, otherwise EN pages resolve
// nothing and the orphan gate above turns vacuous again.
it("loads both locales into one index, with each locale's own nodes present", () => {
  const locales = new Set(Object.values(indexes.en.nodes).map((node) => node.locale));
  expect([...locales].sort()).toEqual(["en", "ru"]);
  // The orphan gate only inspects own-locale nodes: if the fallback collection
  // overwrote them (the locale-collapse bug), the gate would check nothing.
  for (const locale of ["ru", "en"] as Locale[]) {
    const own = Object.values(indexes[locale].nodes).filter((n) => n.locale === locale);
    expect(own.length, `${locale} has no own-locale nodes`).toBeGreaterThan(0);
  }
});
