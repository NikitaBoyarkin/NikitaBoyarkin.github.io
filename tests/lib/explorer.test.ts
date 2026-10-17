import { describe, it, expect } from "bun:test";
import {
  activeFilterCount,
  buildExplorerQuery,
  buildFacets,
  DEFAULT_STATE,
  indexById,
  matchTopic,
  matchesFilters,
  nodeIdFor,
  normalizeText,
  readExplorerState,
  relationsOf,
  scoreRecord,
  selectRecords,
  tokenize,
  toggleValue,
  type ExplorerRecord,
} from "../../src/lib/explorer";

const rec = (over: Partial<ExplorerRecord>): ExplorerRecord => ({
  id: "p:demo",
  kind: "project",
  locale: "ru",
  title: "Демо-проект",
  desc: "Описание демонстрационного проекта про retention.",
  href: "projects/demo/",
  group: "analytics",
  groupLabel: "Аналитика",
  topic: "retention",
  tags: ["retention"],
  tools: ["SQL"],
  year: 2026,
  date: "2026-01-02T00:00:00.000Z",
  image: null,
  relations: [],
  ...over,
});

describe("normalizeText / tokenize", () => {
  it("folds ё, case and diacritics", () => {
    expect(normalizeText("  Ёж  Ёлки ")).toBe("еж елки");
    expect(normalizeText("Café")).toBe("cafe");
  });

  it("tokenizes on whitespace and drops empties", () => {
    expect(tokenize("  retention   curve ")).toEqual(["retention", "curve"]);
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("scoreRecord", () => {
  it("ranks an exact title over a description hit", () => {
    const exact = scoreRecord(rec({ title: "Retention" }), ["retention"]);
    const deep = scoreRecord(rec({ title: "Другое", desc: "про retention" }), ["retention"]);
    expect(exact).toBeGreaterThan(deep);
    expect(deep).toBeGreaterThan(0);
  });

  it("ANDs tokens — one miss zeroes the record", () => {
    expect(scoreRecord(rec({ title: "Retention curve" }), ["retention", "curve"])).toBeGreaterThan(0);
    expect(scoreRecord(rec({ title: "Retention curve" }), ["retention", "zzz"])).toBe(0);
  });

  it("recovers typos in long tokens", () => {
    expect(scoreRecord(rec({ title: "Retention" }), ["retenchion"])).toBeGreaterThan(0);
  });

  it("matches the slug, so a Latin slug finds a Cyrillic-titled record", () => {
    // The RU side of the site is written in Russian but its URLs are Latin —
    // `cohort` has to find «Когортный анализ» (id `p:cohort`).
    const cyrillic = rec({ id: "p:cohort", title: "Когортный анализ", desc: "Разбор удержания." });
    expect(scoreRecord(cyrillic, ["cohort"])).toBeGreaterThan(0);
    expect(scoreRecord(rec({ id: "p:cohort-retention-guide" }), ["cohort"])).toBeGreaterThan(0);
    // Exact title still beats an exact slug.
    const titled = rec({ id: "p:x", title: "Cohort" });
    expect(scoreRecord(titled, ["cohort"])).toBeGreaterThan(scoreRecord(cyrillic, ["cohort"]));
  });

  it("boosts hubs (more relations) above orphans", () => {
    const hub = rec({ relations: [{ type: "related", id: "p:a" }] });
    const orphan = rec({ relations: [] });
    expect(scoreRecord(hub, ["демо"])).toBeGreaterThan(scoreRecord(orphan, ["демо"]));
  });

  it("an empty query scores 0", () => {
    expect(scoreRecord(rec({}), [])).toBe(0);
  });
});

describe("matchesFilters", () => {
  const base = DEFAULT_STATE;

  it("passes everything by default", () => {
    expect(matchesFilters(rec({}), base)).toBe(true);
  });

  it("ORs within one facet, ANDs across facets", () => {
    const r = rec({ tags: ["retention"], tools: ["SQL"] });
    expect(matchesFilters(r, { ...base, tags: ["retention", "other"] })).toBe(true);
    expect(matchesFilters(r, { ...base, tags: ["retention"], tools: ["dbt"] })).toBe(false);
  });

  it("requires a topic when one is selected", () => {
    expect(matchesFilters(rec({ topic: null }), { ...base, topics: ["retention"] })).toBe(false);
    expect(matchesFilters(rec({ topic: "retention" }), { ...base, topics: ["retention"] })).toBe(true);
  });

  it("filters by year and kind", () => {
    expect(matchesFilters(rec({ year: 2026 }), { ...base, years: [2025] })).toBe(false);
    expect(matchesFilters(rec({ kind: "post" }), { ...base, kinds: ["project"] })).toBe(false);
  });

  it("scopes by locale, so an EN view never shows the RU twin", () => {
    const en = rec({ id: "p:demo-en", locale: "en" });
    expect(matchesFilters(rec({}), { ...base, locales: ["en"] })).toBe(false);
    expect(matchesFilters(en, { ...base, locales: ["en"] })).toBe(true);
    expect(matchesFilters(en, { ...base, locales: ["ru", "en"] })).toBe(true);
  });
});

describe("selectRecords", () => {
  const records = [
    rec({ id: "p:a", title: "Бета", date: "2024-01-01T00:00:00.000Z", relations: [] }),
    rec({ id: "p:b", title: "Альфа", date: "2026-01-01T00:00:00.000Z", relations: [] }),
  ];

  it("sorts by title asc and by date desc", () => {
    expect(selectRecords(records, { ...DEFAULT_STATE, sort: "title", dir: "asc" }).map((r) => r.id)).toEqual([
      "p:b",
      "p:a",
    ]);
    expect(selectRecords(records, { ...DEFAULT_STATE, sort: "date", dir: "desc" }).map((r) => r.id)).toEqual([
      "p:b",
      "p:a",
    ]);
  });

  it("is stable and deterministic for the same query", () => {
    const once = selectRecords(records, DEFAULT_STATE).map((r) => r.id);
    const twice = selectRecords(records, DEFAULT_STATE).map((r) => r.id);
    expect(once).toEqual(twice);
  });

  it("ranks by score when a query is present", () => {
    const ranked = selectRecords(
      [rec({ id: "p:x", title: "Другое", desc: "retention" }), rec({ id: "p:y", title: "Retention" })],
      { ...DEFAULT_STATE, q: "retention" },
    );
    expect(ranked[0]!.id).toBe("p:y");
  });
});

describe("buildFacets", () => {
  const records = [
    rec({ id: "p:a", kind: "project", group: "analytics", groupLabel: "Аналитика", tags: ["retention"] }),
    rec({ id: "post:b", kind: "post", group: "guide", groupLabel: "Гайды", tags: ["retention", "sql"] }),
  ];

  it("counts, labels and caps each facet", () => {
    const facets = buildFacets(records, "ru");
    const kind = facets.find((f) => f.key === "kind")!;
    expect(kind.label).toBe("Тип");
    expect(kind.values.map((v) => v.value)).toEqual(["post", "project"]);
    expect(kind.values.map((v) => v.label)).toEqual(["Статьи", "Проекты"]);

    const tag = facets.find((f) => f.key === "tag")!;
    expect(tag.values.find((v) => v.value === "retention")!.count).toBe(2);

    const group = facets.find((f) => f.key === "group")!;
    expect(group.values.find((v) => v.value === "analytics")!.label).toBe("Аналитика");
  });

  it("localizes kind labels for en", () => {
    const facets = buildFacets(records, "en");
    expect(facets.find((f) => f.key === "kind")!.label).toBe("Type");
    expect(facets.find((f) => f.key === "kind")!.values.map((v) => v.label)).toContain("Articles");
  });

  it("counts the locale facet and localizes its values", () => {
    const both = [rec({ id: "p:a", locale: "ru" }), rec({ id: "p:a-en", locale: "en" })];
    const locale = buildFacets(both, "ru").find((f) => f.key === "locale")!;
    expect(locale.values.find((v) => v.value === "ru")!.count).toBe(1);
    expect(locale.values.find((v) => v.value === "en")!.label).toBe("English");
    expect(buildFacets(both, "en").find((f) => f.key === "locale")!.label).toBe("Language");
  });
});

describe("relationsOf", () => {
  const target = rec({ id: "post:b" });
  const source = rec({
    id: "p:a",
    relations: [
      { type: "related", id: "post:b" },
      { type: "topic", id: "post:b" },
      { type: "related", id: "missing" },
    ],
  });

  it("groups by edge type, de-dupes and drops unknown targets", () => {
    const groups = relationsOf(source, indexById([source, target]));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.type).toBe("related");
    expect(groups[0]!.records.map((r) => r.id)).toEqual(["post:b"]);
  });

  it("never relates a record to itself", () => {
    const self = rec({ id: "p:self", relations: [{ type: "related", id: "p:self" }] });
    expect(relationsOf(self, indexById([self]))).toEqual([]);
  });
});

describe("URL state", () => {
  it("round-trips a rich state", () => {
    const state = { ...DEFAULT_STATE, q: "retention", kinds: ["project" as const], tags: ["sql", "ab-testing"], sort: "date" as const, dir: "asc" as const };
    const query = buildExplorerQuery(state);
    expect(readExplorerState(query)).toEqual(state);
  });

  it("omits defaults and returns an empty string for the default state", () => {
    expect(buildExplorerQuery(DEFAULT_STATE)).toBe("");
    expect(readExplorerState("")).toEqual(DEFAULT_STATE);
  });

  it("omits dir when it equals the key's natural direction", () => {
    expect(buildExplorerQuery({ ...DEFAULT_STATE, sort: "title", dir: "asc" })).toBe("?sort=title");
  });

  it("round-trips a key whose natural direction is asc", () => {
    // Regression: `?sort=title` omits `dir` (asc is natural), so reading it back
    // must restore asc — not the global default desc.
    const state = { ...DEFAULT_STATE, sort: "title" as const, dir: "asc" as const };
    expect(readExplorerState(buildExplorerQuery(state))).toEqual(state);
    expect(readExplorerState("?sort=title").dir).toBe("asc");
    expect(readExplorerState("?sort=relations").dir).toBe("desc");
    expect(readExplorerState("?sort=title&dir=desc").dir).toBe("desc");
  });

  it("ignores unknown values and tolerates a leading '?'", () => {
    const parsed = readExplorerState("?kind=project,aliens&sort=banana&year=2026,notanumber");
    expect(parsed.kinds).toEqual(["project"]);
    expect(parsed.sort).toBe(DEFAULT_STATE.sort);
    expect(parsed.years).toEqual([2026]);
  });

  it("merges page defaults (locale-scoped views)", () => {
    expect(readExplorerState("", { kinds: ["term"] }).kinds).toEqual(["term"]);
  });
});

describe("helpers", () => {
  it("counts active filters and toggles values", () => {
    const state = { ...DEFAULT_STATE, kinds: ["project" as const], tags: ["sql"] };
    expect(activeFilterCount(state)).toBe(2);
    expect(toggleValue(state.tags, "sql")).toEqual([]);
    expect(toggleValue(state.tags, "dbt")).toEqual(["sql", "dbt"]);
  });

  it("matches topics by tag first, then by content signal", () => {
    const topics = [
      { key: "sql", match: (t: string) => t === "sql" },
      { key: "retention", match: (t: string) => t === "retention" },
    ];
    expect(matchTopic({ slug: "x", title: "X", tools: [], desc: "", tags: ["retention"] }, topics)).toBe("retention");
    expect(matchTopic({ slug: "sql-case-study", title: "SQL", tools: [], desc: "", tags: [] }, topics)).toBe("sql");
    expect(matchTopic({ slug: "x", title: "X", tools: [], desc: "", tags: [] }, topics)).toBeNull();
  });

  it("derives graph-compatible node ids", () => {
    expect(nodeIdFor("project", "volta")).toBe("p:volta");
    expect(nodeIdFor("post", "cuped")).toBe("post:cuped");
    expect(nodeIdFor("term", "cuped")).toBe("g:cuped");
    expect(nodeIdFor("topic", "sql")).toBe("topic:sql");
  });
});
