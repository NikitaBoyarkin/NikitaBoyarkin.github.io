/**
 * Reader slides — a Sätteri mdast plugin that splits an article body into
 * `<section class="reader-slide" data-slide="N">` ranges at every top-level
 * `##` heading, so the reader layout can page over the article instead of
 * scrolling one long column.
 *
 * Why mdast `html` nodes rather than a hast `element` wrapper: an `<section>`
 * spans a *range* of siblings, and no tree API can hold unbalanced open/close
 * tags. Building the wrapper as a real element means every slide's content has
 * to be moved into it, and Sätteri's structural payload treats a node read from
 * the tree as a `REF` that is *copied*, not moved — the built pages showed each
 * paragraph twice, and neither `removeNode` on the original nor replacing the
 * root dropped the leftover copy. Two `html` nodes around the range move
 * nothing, so heading ids, code-block properties and every other attribute
 * survive exactly as the other plugins left them.
 *
 * Splitting after the mdast plugins (this factory is appended to the list) keeps
 * the order independent: nothing here reads or rewrites the nodes in between.
 *
 * Contract (bound by the reader stylesheet and its tests):
 * - Each top-level h2 starts a new slide; the slide runs to the next
 *   top-level h2, exclusive.
 * - Content before the first h2 is slide 0; h2 slides are 1-based. A body that
 *   opens with `##` gets no empty slide 0.
 * - h2s nested in other containers never split, because only root children
 *   are inspected.
 * - No top-level h2 → nothing is emitted, the page stays a plain article.
 */
import { fileURLToPath } from "node:url";

/** Collections whose bodies are paged. Everything else compiles untouched. */
const COLLECTION_PATH_MARKERS = [
  "/src/content/posts/",
  "/src/content/posts-en/",
  "/src/content/projects/",
  "/src/content/projects-en/",
];

export interface SlideNode {
  type: string;
  depth?: number;
  value?: string;
  children?: readonly SlideNode[];
}

/** An `html` mdast node — serialized verbatim, tags included. */
export interface SlideHtmlNode {
  type: "html";
  value: string;
}

/** Structural subset of Sätteri's `MdastVisitorContext` that this plugin uses. */
export interface ReaderSlidesContext {
  insertBefore(node: SlideNode, newNode: SlideHtmlNode): void;
  insertAfter(node: SlideNode, newNode: SlideHtmlNode): void;
}

export interface ReaderSlidesPlugin {
  name: string;
  before(root: SlideNode, ctx: ReaderSlidesContext): void;
}

export interface ReaderSlidesFactoryContext {
  readonly fileURL: URL | undefined;
}

export type ReaderSlidesPluginFactory = (
  ctx: ReaderSlidesFactoryContext,
) => ReaderSlidesPlugin | false;

/** One slide: the anchor node that opens it plus every node up to the next h2. */
export interface SlideGroup {
  anchor: SlideNode;
  members: readonly SlideNode[];
  slide: number;
}

/** A top-level heading of depth 2 — mdast's `heading`, as it reaches this phase. */
function isTopLevelH2(node: SlideNode): boolean {
  return node.type === "heading" && node.depth === 2;
}

/**
 * Group root children into slides. `members` excludes the anchor (its opening
 * tag goes before the anchor). Slides are numbered 0 for the intro and 1… for
 * the h2 runs, in document order.
 */
export function buildSlideGroups(children: readonly SlideNode[]): SlideGroup[] {
  const headings: number[] = [];
  children.forEach((node, index) => {
    if (isTopLevelH2(node)) headings.push(index);
  });
  if (headings.length === 0) return [];

  const groups: SlideGroup[] = [];
  if (headings[0] > 0) {
    // Intro before the first heading: slide 0. Only emitted when non-empty,
    // so a body that opens with `##` starts at slide 1 with no empty section.
    groups.push({
      anchor: children[0],
      members: children.slice(1, headings[0]),
      slide: 0,
    });
  }
  let slide = 1;
  for (let i = 0; i < headings.length; i += 1) {
    const start = headings[i];
    const end = i + 1 < headings.length ? headings[i + 1] : children.length;
    groups.push({
      anchor: children[start],
      members: children.slice(start + 1, end),
      slide: slide,
    });
    slide += 1;
  }
  return groups;
}

function openTag(slide: number): SlideHtmlNode {
  return { type: "html", value: `<section class="reader-slide" data-slide="${slide}">` };
}

/** Shared instance: the node is never mutated, so one object serves every slide. */
const CLOSE_TAG: SlideHtmlNode = { type: "html", value: "</section>" };

/** Factory consumed by Sätteri's `mdastPlugins`; a no-op outside the four paged collections. */
export function readerSlides(): ReaderSlidesPluginFactory {
  return (ctx) => {
    const fileURL = ctx.fileURL;
    if (!fileURL) return false;
    let filePath: string;
    try {
      filePath = fileURLToPath(fileURL);
    } catch {
      return false;
    }
    const normalized = filePath.split("\\").join("/");
    if (!COLLECTION_PATH_MARKERS.some((marker) => normalized.includes(marker))) return false;

    return {
      name: "reader-slides",
      before(root, context) {
        // Groups are emitted in document order, so at a slide boundary the
        // close of one range is queued before the open of the next; both land
        // at the same position between the two anchors.
        for (const group of buildSlideGroups(root.children ?? [])) {
          const last = group.members[group.members.length - 1] ?? group.anchor;
          context.insertBefore(group.anchor, openTag(group.slide));
          context.insertAfter(last, CLOSE_TAG);
        }
      },
    };
  };
}
