import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { nextMathSpan, splitMathText } from "../../src/lib/katex-math.ts";

describe("nextMathSpan", () => {
  test("matches an inline run", () => {
    expect(nextMathSpan("где $X$ — метрика", 0)).toEqual({
      start: 4,
      end: 7,
      tex: "X",
      display: false,
    });
  });

  test("prefers a display run over two inline ones", () => {
    expect(nextMathSpan("$$E=mc^2$$", 0)).toEqual({
      start: 0,
      end: 10,
      tex: "E=mc^2",
      display: true,
    });
  });

  test("ignores an unpaired dollar", () => {
    expect(nextMathSpan("цена $50 без закрывающего", 0)).toBeNull();
  });

  test("ignores an empty run", () => {
    expect(nextMathSpan("a $$b", 0)).toBeNull();
  });
});

describe("splitMathText", () => {
  test("returns null when there is no math", () => {
    expect(splitMathText("просто текст")).toBeNull();
  });

  test("splits prose around a rendered formula", () => {
    const parts = splitMathText("до $X$ после");
    expect(parts).not.toBeNull();
    expect(parts!.map((p) => p.type)).toEqual(["text", "html", "text"]);
    expect((parts![0] as { value: string }).value).toBe("до ");
    expect((parts![1] as { value: string }).value).toContain("katex");
    expect((parts![2] as { value: string }).value).toBe(" после");
  });

  test("renders bad TeX instead of throwing", () => {
    const parts = splitMathText("$\\frac{1}{$");
    expect(parts === null || parts.every((p) => typeof p.value === "string")).toBe(true);
  });

  test("handles a formula that spans the whole node", () => {
    const parts = splitMathText("$n$");
    expect(parts!.map((p) => p.type)).toEqual(["html"]);
  });
});

describe("glossary math source", () => {
  // The plugin sees text *after* CommonMark escaping, and `%` is ASCII punctuation,
  // so `\%` reaches KaTeX as a bare `%` — a LaTeX comment that silently swallows
  // the rest of the formula (nps rendered as "NPS ="). Write the words instead.
  test("no backslash-escaped percent in glossary notes", () => {
    const offenders: string[] = [];
    for (const dir of ["src/content/glossary", "src/content/glossary-en"]) {
      for (const file of readdirSync(dir)) {
        if (!file.endsWith(".md")) continue;
        if (readFileSync(join(dir, file), "utf8").includes("\\%")) offenders.push(`${dir}/${file}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
