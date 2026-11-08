import { describe, it, expect } from "bun:test";
import { normalize, tokenize, prepareIndex, rankEntries } from "../../src/lib/search-rank";

describe("normalize", () => {
  it("lowercases and folds ё", () => {
    expect(normalize("Ёлка")).toBe("елка");
    expect(normalize("Учёт")).toBe("учет");
  });

  it("keeps й intact", () => {
    // NFKD + combining-mark removal would yield "иод" here, and the hero search
    // would then match "май" for "маи". This assertion is why that is absent.
    expect(normalize("Йод")).toBe("йод");
    expect(normalize("май")).toBe("май");
  });
});

describe("tokenize", () => {
  it("splits on whitespace and folds case", () => {
    expect(tokenize("A/B  ТЕСТ")).toEqual(["a/b", "тест"]);
  });

  it("returns no tokens for blank input", () => {
    expect(tokenize("   ")).toEqual([]);
    expect(tokenize("")).toEqual([]);
  });
});

const ENTRIES = [
  { type: "post", locale: "ru", title: "Когортный анализ", desc: "учёт выручки", href: "/posts/ru" },
  { type: "post", locale: "en", title: "Cohort analysis", desc: "", href: "/en/posts/en" },
  {
    type: "topic",
    locale: "ru",
    title: "Retention / когорты",
    desc: "",
    tags: ["cohort-analysis", "Retention / cohorts"],
    href: "/topics/retention",
  },
  {
    type: "project",
    locale: "ru",
    title: "CRM",
    desc: "эксперимент",
    tools: ["pandas"],
    href: "/projects/crm",
    date: "2026-01-01T00:00:00.000Z",
  },
];

const hrefs = (q: string, locale: "ru" | "en" = "ru") =>
  rankEntries(prepareIndex(ENTRIES), tokenize(q), locale, 6).map((e) => e.href);

describe("rankEntries", () => {
  it("matches ё both ways", () => {
    expect(hrefs("учет")).toEqual(["/posts/ru"]);
    expect(hrefs("учёт")).toEqual(["/posts/ru"]);
  });

  it("drops the other locale but keeps RU-only topic hubs", () => {
    expect(hrefs("analysis", "ru")).not.toContain("/en/posts/en");
    expect(hrefs("analysis", "en")).toEqual(["/en/posts/en", "/topics/retention"]);
  });

  it("falls back to a partial match when one token misses", () => {
    expect(hrefs("когорт zzqqq")).toContain("/posts/ru");
  });

  it("matches a tag by prefix, not only by exact equality", () => {
    expect(hrefs("cohort")).toContain("/topics/retention");
  });

  it("ranks an exact title above a description hit", () => {
    expect(hrefs("crm")[0]).toBe("/projects/crm");
  });
});
