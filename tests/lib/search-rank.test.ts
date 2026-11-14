import { describe, it, expect, test } from "bun:test";
import {
  normalize,
  tokenize,
  prepareIndex,
  rankEntries,
  highlightRanges,
} from "../../src/lib/search-rank";
import { translitRu, stemRu } from "../../src/lib/translit";

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

  it("body match does not evict near-miss", () => {
    const idx = prepareIndex([
      {
        type: "post",
        locale: "ru",
        title: "Заметка",
        desc: "",
        body: "когорты и выручка",
        href: "/posts/body-and",
      },
      { type: "post", locale: "ru", title: "Когортный анализ", desc: "", href: "/posts/near-miss" },
    ]);
    const ranked = rankEntries(idx, tokenize("когорты выручка"), "ru", 6).map((e) => e.href);
    expect(ranked).toContain("/posts/body-and");
    expect(ranked).toContain("/posts/near-miss");
  });

  it("keeps a body-only single-token match reachable", () => {
    // The native row is what made this a witness: with only the body-only entry
    // the AND set and the ANY fallback produce the same list, so the test could
    // not tell the two apart.
    const idx = prepareIndex([
      {
        type: "post",
        locale: "ru",
        title: "Заметка",
        desc: "",
        body: "когорты и выручка",
        href: "/posts/body-only",
      },
      { type: "post", locale: "ru", title: "Выручка", desc: "", href: "/posts/native" },
    ]);
    const ranked = rankEntries(idx, tokenize("выручка"), "ru", 6).map((e) => e.href);
    expect(ranked).toContain("/posts/native");
    expect(ranked).toContain("/posts/body-only");
  });

  it("matches a tag by prefix, not only by exact equality", () => {
    expect(hrefs("cohort")).toContain("/topics/retention");
  });

  it("ranks an exact title above a description hit", () => {
    expect(hrefs("crm")[0]).toBe("/projects/crm");
  });

  it("reaches a title through a typo", () => {
    expect(hrefs("crmm")).toEqual(["/projects/crm"]);
    // Inflected-form typo: no exact/prefix/includes tier sees this one.
    expect(hrefs("когорты")).toContain("/posts/ru");
  });

  it("ranks an exact match above a typo, both ways", () => {
    const idx = prepareIndex([
      { type: "project", locale: "ru", title: "Retention", desc: "", href: "/projects/exact" },
      { type: "project", locale: "ru", title: "Retantion", desc: "", href: "/projects/typo" },
    ]);
    const ranked = (q: string) => rankEntries(idx, tokenize(q), "ru", 6).map((e) => e.href);
    expect(ranked("retention")).toEqual(["/projects/exact", "/projects/typo"]);
    expect(ranked("retantion")).toEqual(["/projects/typo", "/projects/exact"]);
  });

  it("leaves short tokens and noise to exact matching", () => {
    expect(hrefs("zzzz")).toEqual([]);
    expect(hrefs("crm")).toEqual(["/projects/crm"]);
  });
});

describe("stemRu", () => {
  test("reduces inflected forms of one word to a shared stem", () => {
    expect(stemRu("выбросы")).toBe("выброс");
    expect(stemRu("выбросам")).toBe("выброс");
    expect(stemRu("когорты")).toBe("когорт");
    expect(stemRu("когортный")).toBe("когорт");
    expect(stemRu("метрика")).toBe("метрик");
    expect(stemRu("метрики")).toBe("метрик");
  });

  test("leaves short words and Latin words alone", () => {
    expect(stemRu("дом")).toBe("дом");
    expect(stemRu("май")).toBe("май");
    expect(stemRu("Retention")).toBe("retention");
    expect(stemRu("анализ")).toBe("анализ");
  });

  test("never returns fewer than three characters", () => {
    // "оса" would strip to "ос" — the length guard keeps the word whole.
    for (const w of ["оса", "уха", "эха", "выбросы", "когортный"]) {
      expect(stemRu(w).length).toBeGreaterThanOrEqual(3);
    }
  });

  test("joins the nominative and genitive of one noun", () => {
    expect(stemRu("решение")).toBe(stemRu("решения"));
  });

  test("joins a feminine -ь noun to its plural", () => {
    expect(stemRu("модели")).toBe(stemRu("модель"));
  });

  test("joins the -ль plural family, not only -ели", () => {
    expect(stemRu("детали")).toBe(stemRu("деталь"));
    expect(stemRu("медали")).toBe(stemRu("медаль"));
  });

  test("does not strip a soft sign and an ending in one pass", () => {
    // Double truncation merged unrelated roots: «постель» landed on «пост»,
    // and a query for it surfaced the post titled "Пост о когортах".
    expect(stemRu("постель")).toBe("постел");
    expect(stemRu("спираль")).toBe("спирал");
    expect(stemRu("постель")).not.toBe(stemRu("пост"));
  });

  test("keeps unrelated nouns apart", () => {
    expect(stemRu("могила")).not.toBe(stemRu("могут"));
  });

  test("keeps the four-letter stem floor", () => {
    // «могила» is the boundary: it lands exactly on four, and one more strip
    // would collapse it onto «могут».
    expect(stemRu("могила")).toBe("моги");
    for (const w of ["решение", "решения", "модели", "модель", "могила"]) {
      expect(stemRu(w).length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("translitRu", () => {
  test("maps Cyrillic to lowercase Latin", () => {
    expect(translitRu("Возвратность")).toBe("vozvratnost");
    expect(translitRu("Щука")).toBe("shchuka");
    expect(translitRu("Когорты")).toBe("kogorty");
  });

  test("passes Latin, digits and punctuation through", () => {
    expect(translitRu("CRM 101")).toBe("crm 101");
    expect(translitRu("A/B")).toBe("a/b");
  });
});

describe("stem-aware ranking", () => {
  test("matches an inflected query through the shared stem", () => {
    const idx = prepareIndex([
      { type: "post", locale: "ru", title: "Выбросам и когортам", desc: "", href: "/posts/infl" },
    ]);
    const ranked = (q: string) => rankEntries(idx, tokenize(q), "ru", 6).map((e) => e.href);
    expect(ranked("выбросы")).toEqual(["/posts/infl"]);
    expect(ranked("когорты")).toEqual(["/posts/infl"]);
  });

  test("keeps an exact title above a stem-equal one", () => {
    const idx = prepareIndex([
      { type: "post", locale: "ru", title: "выбросам", desc: "", href: "/posts/stem" },
      { type: "post", locale: "ru", title: "выбросы", desc: "", href: "/posts/exact" },
    ]);
    expect(rankEntries(idx, tokenize("выбросы"), "ru", 6).map((e) => e.href)).toEqual([
      "/posts/exact",
      "/posts/stem",
    ]);
  });

  test("folds ё in both the index and the query", () => {
    const idx = prepareIndex([
      { type: "post", locale: "ru", title: "Учёт выручки", desc: "", href: "/posts/yo" },
    ]);
    const ranked = (q: string) => rankEntries(idx, tokenize(q), "ru", 6).map((e) => e.href);
    expect(ranked("учет")).toEqual(["/posts/yo"]);
    expect(ranked("учёт")).toEqual(["/posts/yo"]);
  });
});

describe("transliterated queries", () => {
  test("reach a Cyrillic title", () => {
    const idx = prepareIndex([
      { type: "post", locale: "ru", title: "Возвратность", desc: "", href: "/posts/ru-title" },
    ]);
    expect(rankEntries(idx, ["vozvratnost"], "ru", 6).map((e) => e.href)).toEqual([
      "/posts/ru-title",
    ]);
  });

  test("never outrank a native exact match", () => {
    const idx = prepareIndex([
      { type: "post", locale: "ru", title: "Возвратность", desc: "", href: "/posts/translit" },
      { type: "post", locale: "ru", title: "Vozvratnost", desc: "", href: "/posts/native" },
    ]);
    expect(rankEntries(idx, ["vozvratnost"], "ru", 6).map((e) => e.href)).toEqual([
      "/posts/native",
      "/posts/translit",
    ]);
  });
});

describe("per-type quota", () => {
  const mk = (type: string, n: number) => ({
    type,
    locale: "ru",
    title: `метрика ${n}`,
    desc: "",
    href: `/${type}/${n}`,
  });
  // Posts outnumber projects and all six score the same.
  const IDX = prepareIndex([
    mk("post", 1),
    mk("post", 2),
    mk("post", 3),
    mk("project", 1),
    mk("project", 2),
    mk("post", 4),
  ]);

  test("gives every type a slot before a second one", () => {
    expect(rankEntries(IDX, tokenize("метрика"), "ru", 4).map((e) => e.href)).toEqual([
      "/post/1",
      "/project/1",
      "/post/2",
      "/project/2",
    ]);
  });

  test("drops nothing while the list still has room", () => {
    expect(
      rankEntries(IDX, tokenize("метрика"), "ru", 6)
        .map((e) => e.href)
        .sort(),
    ).toEqual(["/post/1", "/post/2", "/post/3", "/post/4", "/project/1", "/project/2"].sort());
  });

  test("is deterministic for equal scores", () => {
    const once = rankEntries(IDX, tokenize("метрика"), "ru", 6).map((e) => e.href);
    const twice = rankEntries(IDX, tokenize("метрика"), "ru", 6).map((e) => e.href);
    expect(once).toEqual(twice);
  });
});

describe("highlightRanges", () => {
  test("returns code-unit offsets that survive ё folding", () => {
    const text = "Ёлка и ёж";
    expect(highlightRanges(text, ["елка"])).toEqual([[0, 4]]);
    expect(highlightRanges(text, ["еж"])).toEqual([[7, 9]]);
    const [span] = highlightRanges(text, ["еж"]);
    // Offsets index the ORIGINAL string, so the mark keeps its `ё`.
    expect(text.slice(span[0], span[1])).toBe("ёж");
  });

  test("marks an inflected word through its stem", () => {
    const text = "анализ выбросам";
    expect(highlightRanges(text, ["выбросы"])).toEqual([[7, 15]]);
    expect(text.slice(7, 15)).toBe("выбросам");
  });

  test("returns no ranges for an empty token list", () => {
    expect(highlightRanges("метрика", [])).toEqual([]);
    expect(highlightRanges("метрика", ["", "а"])).toEqual([]);
  });

  test("merges overlapping ranges from repeated tokens", () => {
    expect(highlightRanges("Метрика", ["метрика", "МЕТРИКА"])).toEqual([[0, 7]]);
    // The same word twice: one range each, duplicates collapsed, still ascending.
    expect(highlightRanges("Метрика Метрика", ["метрика", "МЕТРИКА"])).toEqual([
      [0, 7],
      [8, 15],
    ]);
  });
});
