/**
 * KaTeX math renderer — a Sätteri mdast plugin that turns `$…$` (inline) and
 * `$$…$$` (display) runs in glossary notes into server-rendered KaTeX HTML.
 *
 * Why a text-node plugin rather than Sätteri's `features.math`: that feature is
 * a parser-level switch, so enabling it would also reinterpret the literal
 * dollar amounts in existing posts (`$0,10 … $0,50`) as math. This plugin is
 * scoped by file path to the glossary collections, so no other page changes.
 *
 * Runs before the glossary linker in the plugin array: math first, so a term
 * name inside `\text{…}` never gets a markdown link injected into its LaTeX.
 */
import katex from "katex";
import { fileURLToPath } from "node:url";

const GLOSSARY_PATH_MARKER = "/src/content/glossary";

/** Text inside these parents is not prose — never rewrite it. */
const SKIP_PARENT_TYPES = new Set(["heading", "link", "code", "inlineCode", "html"]);

export interface MathTextNode {
  type: "text";
  value: string;
}

export interface MathHtmlNode {
  type: "html";
  value: string;
}

export type MathReplacement = MathTextNode | MathHtmlNode;

/** Structural subset of Sätteri's `MdastVisitorContext` that this plugin uses. */
export interface MathPluginContext {
  readonly fileURL: URL | undefined;
  parent(node: unknown): { type?: string } | undefined;
  replaceNode(node: unknown, replacement: MathReplacement[]): void;
}

export interface MathPlugin {
  name: string;
  text?(node: { type: string; value: string }, ctx: MathPluginContext): void;
}

export interface MathPluginFactoryContext {
  readonly fileURL: URL | undefined;
}

export type MathPluginFactory = (ctx: MathPluginFactoryContext) => MathPlugin | false;

interface MathSpan {
  start: number;
  end: number;
  tex: string;
  display: boolean;
}

/**
 * Next `$…$` / `$$…$$` run at or after `from`, or `null`. `$$` is tried first so
 * a display run is not mistaken for two inline ones. Runs with empty or
 * newline-containing (inline only) bodies are skipped rather than matched, so an
 * unpaired `$` degrades to literal text.
 */
export function nextMathSpan(value: string, from: number): MathSpan | null {
  for (let i = from; i < value.length; i += 1) {
    if (value[i] !== "$") continue;
    const isDouble = value[i + 1] === "$";
    const openLen = isDouble ? 2 : 1;
    const close = value.indexOf(isDouble ? "$$" : "$", i + openLen);
    if (close === -1) continue;
    const tex = value.slice(i + openLen, close);
    if (!tex.trim() || (!isDouble && tex.includes("\n"))) continue;
    return { start: i, end: close + openLen, tex, display: isDouble };
  }
  return null;
}

/** KaTeX render; `throwOnError: false` keeps bad TeX visible instead of failing the build. */
export function renderMath(tex: string, display: boolean): string {
  return katex.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    strict: false,
  });
}

/** Split a text node into an alternating text/HTML node list, or `null` if it has no math. */
export function splitMathText(value: string): MathReplacement[] | null {
  const parts: MathReplacement[] = [];
  let cursor = 0;
  for (;;) {
    const span = nextMathSpan(value, cursor);
    if (!span) break;
    if (span.start > cursor) parts.push({ type: "text", value: value.slice(cursor, span.start) });
    parts.push({ type: "html", value: renderMath(span.tex, span.display) });
    cursor = span.end;
  }
  if (parts.length === 0) return null;
  if (cursor < value.length) parts.push({ type: "text", value: value.slice(cursor) });
  return parts;
}

/** Factory consumed by Sätteri's `mdastPlugins`; a no-op outside the glossary. */
export function katexMath(): MathPluginFactory {
  return (ctx) => {
    const fileURL = ctx.fileURL;
    if (!fileURL) return false;
    let filePath: string;
    try {
      filePath = fileURLToPath(fileURL);
    } catch {
      return false;
    }
    if (!filePath.split("\\").join("/").includes(GLOSSARY_PATH_MARKER)) return false;

    return {
      name: "katex-math",
      text(node, context) {
        const parentType = context.parent(node)?.type;
        if (parentType !== undefined && SKIP_PARENT_TYPES.has(parentType)) return;
        const value = node.value;
        if (!value || !value.includes("$")) return;
        const replacement = splitMathText(value);
        if (replacement) context.replaceNode(node, replacement);
      },
    };
  };
}
