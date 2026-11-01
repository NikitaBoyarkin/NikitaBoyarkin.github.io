/**
 * Figures in running text — a Sätteri mdast plugin that wraps every measurement
 * stated inside a sentence in `<span class="figure">`, so a result in prose
 * takes the same ink as one in a display block (`--text-accent-figure`).
 *
 * Why a plugin and not a stylesheet: the number sits inside a text node, so
 * there is nothing to select — the same reason `FigureText.astro` exists for
 * component strings. `splitFigures` stays the one place that decides what
 * counts as a figure, so the markdown surface and the component surface cannot
 * drift apart; this file only carries the result into the tree.
 *
 * Emits mdast `html` nodes, the way `katex-math.ts` emits inline math: raw HTML
 * inside a paragraph is already rendered on this site (inline `$…$` in the
 * glossary), whereas wrapping the run in a real element would mean replacing a
 * node the tree payload hands back as a copy — `reader-slides.ts` documents what
 * that costs. A figure token is digits plus at most a sign, a currency, a
 * decimal separator and a `%`/`×`, so the emitted tag never needs escaping.
 *
 * Operational note: this plugin runs inside the markdown compile, and Astro
 * caches compiled content. A change here does NOT invalidate that cache, so
 * `bun run build` alone can ship the previous markup — remove `.astro/` and
 * `dist/` before verifying an edit (found the hard way on 2026-11-01: a rebuilt
 * page still carried the old, date-eating output).
 */
import { splitFigures } from "./figures";

/**
 * Text inside these parents is not prose. A link must never turn orange — the
 * wikilink and glossary plugins have already cut their labels out into `link`
 * children by the time this runs — and a heading keeps its own colour.
 *
 * Tables are skipped on purpose: a cohort matrix is data, and its cells are
 * sized to fit a grid. Bolding every number there would both break the table's
 * own type scale and make the numbers compete with the row labels.
 */
const SKIP_PARENT_TYPES = new Set([
  "heading",
  "link",
  "linkReference",
  "inlineCode",
  "code",
  "html",
  "table",
  "tableCell",
]);

export interface FigureTextNode {
  type: "text";
  value: string;
}

export interface FigureHtmlNode {
  type: "html";
  value: string;
}

export type FigureReplacement = FigureTextNode | FigureHtmlNode;

/** Structural subset of Sätteri's `MdastVisitorContext` that this plugin uses. */
export interface FiguresContext {
  readonly sourceFormat: string;
  parent(node: unknown): { type?: string } | undefined;
  replaceNode(node: unknown, replacement: FigureReplacement[]): void;
}

export interface FiguresPlugin {
  name: string;
  text?(node: { type: string; value: string }, ctx: FiguresContext): void;
}

export interface FiguresFactoryContext {
  readonly sourceFormat: string;
}

export type FiguresPluginFactory = (ctx: FiguresFactoryContext) => FiguresPlugin | false;

/**
 * Alternating text/`<span>` nodes for one text node, or `null` when it carries
 * no figure. Every character of `value` survives in order, so no caller can
 * silently lose a run of prose to the split.
 */
export function splitFigureNodes(value: string): FigureReplacement[] | null {
  if (!value) return null;
  // One pass: `splitFigures` already tells us whether anything is a figure.
  const spans = splitFigures(value);
  if (!spans.some((span) => span.figure)) return null;
  return spans.map((span): FigureReplacement =>
    span.figure
      ? { type: "html", value: `<span class="figure">${span.text}</span>` }
      : { type: "text", value: span.text },
  );
}

/** Factory consumed by Sätteri's `mdastPlugins`. */
export function figures(): FiguresPluginFactory {
  return (ctx) => {
    // Markdown only. MDX has no verbatim raw-HTML node — a `<span>` there is
    // parsed as JSX — so the about body stands down rather than hand the JSX
    // pipeline a node it would have to interpret.
    if (ctx.sourceFormat !== "markdown") return false;

    return {
      name: "figures",
      text(node, context) {
        // Walk the ancestors, not just the direct parent: a figure can sit inside
        // `<strong>` inside a table cell, and the table rule must still win. The
        // depth cap is a guard, not a limit — mdast nests far shallower than this.
        let ancestor = context.parent(node);
        for (let depth = 0; ancestor && depth < 16; depth++) {
          if (ancestor.type !== undefined && SKIP_PARENT_TYPES.has(ancestor.type)) return;
          ancestor = context.parent(ancestor);
        }
        const replacement = splitFigureNodes(node.value);
        if (replacement) context.replaceNode(node, replacement);
      },
    };
  };
}
