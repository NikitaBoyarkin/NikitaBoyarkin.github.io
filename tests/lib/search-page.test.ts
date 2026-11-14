// Pure logic of the addressable search page. The served-HTML behaviour is
// covered in `tests/built/search-page.test.ts`; this file pins the rules that
// decide *what* that HTML contains — query syntax, tag folding and the facet
// threshold — because a drift here shows up as a silently different page.
import { describe, it, expect } from "bun:test";
import {
  filterHref,
  filterRecords,
  localePool,
  parseQuery,
  pluralResults,
  runSearch,
  tagFacets,
  tagKey,
  tagSlug,
} from "../../src/lib/search-page";
import type { SearchEntry } from "../../src/lib/search-rank";

const entry = (over: Partial<SearchEntry>): SearchEntry => ({
  type: "post",
  locale: "ru",
  title: "Запись",
  desc: "описание",
  tags: [],
  tools: [],
  href: "/posts/x/",
  date: null,
  ...over,
});

describe("parseQuery", () => {
  it("treats bare words as free terms", () => {
    expect(parseQuery("когорты").terms).toEqual(["когорты"]);
  });

  it("reads #tag and tag: as the same filter", () => {
    expect(parseQuery("#retention").tags).toEqual(["retention"]);
    expect(parseQuery("tag:Retention").tags).toEqual(["retention"]);
    expect(parseQuery("#retention").terms).toEqual([]);
  });

  it("reads collection: in singular, plural and synonym forms", () => {
    for (const raw of ["collection:projects", "collection:project", "type:projects", "in:project"]) {
      expect(parseQuery(raw).collections).toEqual(["project"]);
    }
    expect(parseQuery("collection:library").collections).toEqual(["source"]);
  });

  it("dedupes filters that fold to the same tag", () => {
    expect(parseQuery("#a-b-testing #ab-testing").tags).toEqual(["a-b-testing"]);
  });

  it("keeps an unknown collection: value as a term, so the page comes back empty", () => {
    const spec = parseQuery("collection:nope");
    expect(spec.collections).toEqual([]);
    expect(spec.terms).toEqual(["collection:nope"]);
  });

  it("composes filters and terms", () => {
    const spec = parseQuery("sql #python collection:posts");
    expect(spec).toEqual({ terms: ["sql"], tags: ["python"], collections: ["post"] });
  });
});

describe("tag folding", () => {
  it("slugifies punctuation and folds ё", () => {
    expect(tagSlug("A/B Testing")).toBe("a-b-testing");
    expect(tagSlug("A/B-тест")).toBe("a-b-тест");
    expect(tagSlug("Статистика")).toBe("статистика");
    expect(tagSlug("учёт")).toBe("учет");
  });

  it("ignores hyphens when comparing, so two spellings are one filter", () => {
    expect(tagKey(tagSlug("A/B Testing"))).toBe(tagKey(tagSlug("ab-testing")));
  });
});

describe("filterRecords", () => {
  const records = [
    entry({ href: "/posts/a/", tags: ["A/B Testing"] }),
    entry({ href: "/posts/b/", tags: ["ab-testing"] }),
    entry({ href: "/posts/c/", tags: ["retention"] }),
    entry({ href: "/projects/p/", type: "project", tags: ["retention"] }),
  ];

  it("matches both spellings of one tag", () => {
    const spec = parseQuery("#a-b-testing");
    expect(filterRecords(records, spec).map((r) => r.href)).toEqual(["/posts/a/", "/posts/b/"]);
  });

  it("splits on collection", () => {
    const spec = parseQuery("collection:projects");
    expect(filterRecords(records, spec).map((r) => r.href)).toEqual(["/projects/p/"]);
  });

  it("ANDs tag and collection", () => {
    const spec = parseQuery("#retention collection:project");
    expect(filterRecords(records, spec).map((r) => r.href)).toEqual(["/projects/p/"]);
  });

  it("returns everything when no filter is set", () => {
    expect(filterRecords(records, parseQuery(""))).toHaveLength(records.length);
  });
});

describe("localePool", () => {
  it("keeps the RU-only topic hubs reachable from /en/ and nothing else RU", () => {
    const records = [
      entry({ href: "/topics/sql/", type: "topic" }),
      entry({ href: "/posts/ru/", locale: "ru" }),
      entry({ href: "/en/posts/en/", locale: "en" }),
    ];
    expect(localePool(records, "en").map((r) => r.href)).toEqual(["/topics/sql/", "/en/posts/en/"]);
  });
});

describe("runSearch", () => {
  const records = [
    entry({ href: "/posts/new/", title: "Новая", date: "2026-02-01T00:00:00.000Z" }),
    entry({ href: "/posts/old/", title: "Старая", date: "2025-01-01T00:00:00.000Z" }),
    entry({ href: "/posts/undated/", title: "Без даты", date: null }),
    entry({ href: "/posts/other/", title: "Когорты", date: "2025-06-01T00:00:00.000Z" }),
  ];

  it("orders a filter-only list by date, undated last", () => {
    const run = runSearch(records, "", "ru", 10);
    expect(run.items.map((r) => r.href)).toEqual([
      "/posts/new/",
      "/posts/other/",
      "/posts/old/",
      "/posts/undated/",
    ]);
  });

  it("ranks free terms through the shared ranker", () => {
    const run = runSearch(records, "когорты", "ru", 10);
    expect(run.items[0].href).toBe("/posts/other/");
    expect(run.spec.terms).toEqual(["когорты"]);
  });

  it("reports the filtered pool size and honours the limit", () => {
    const run = runSearch(records, "", "ru", 2);
    expect(run.total).toBe(4);
    expect(run.items).toHaveLength(2);
  });
});

describe("tagFacets", () => {
  it("drops tags below the threshold and labels with the most common spelling", () => {
    const records = [
      entry({ href: "/1/", tags: ["A/B Testing"] }),
      entry({ href: "/2/", tags: ["A/B Testing"] }),
      entry({ href: "/3/", tags: ["ab-testing"] }),
      entry({ href: "/4/", tags: ["rare"] }),
    ];
    const facets = tagFacets(records, "ru");
    expect(facets.map((f) => [f.slug, f.label, f.count])).toEqual([["a-b-testing", "A/B Testing", 3]]);
  });
});

describe("output helpers", () => {
  it("builds locale-aware filter hrefs", () => {
    expect(filterHref({ kind: "tag", value: "retention" }, "ru")).toBe("/search/tag/retention/");
    expect(filterHref({ kind: "collection", value: "projects" }, "en")).toBe(
      "/en/search/collection/projects/",
    );
  });

  it("pluralises the RU count", () => {
    expect([1, 2, 5, 11, 21, 112].map((n) => pluralResults(n, "ru"))).toEqual([
      "результат",
      "результата",
      "результатов",
      "результатов",
      "результат",
      "результатов",
    ]);
    expect(pluralResults(1, "en")).toBe("result");
    expect(pluralResults(0, "en")).toBe("results");
  });
});
