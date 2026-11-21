/**
 * Cuts a post body into one dashboard panel per H2 section.
 *
 * The posts template wraps `<Content />` in a `<SectionTabs size="sm">` so a
 * 6–11 section article reads as a small dashboard instead of one long scroll —
 * the same pattern the project case body already uses (`case-sections-hast.ts`).
 * The markdown arrives as one block, so something has to draw the boundaries;
 * doing it in the pipeline keeps the page server-rendered: every word ships in
 * the HTML, the tablist is plain markup, and with JS off the `<noscript>` rule in
 * `SectionTabs.astro` reveals every panel again.
 *
 * Difference from the project case version: there is no group table here. A
 * project body repeats the same eight headings, so eight sections fold into five
 * tabs; every post has its own H2 set, so one heading *is* one tab. The tab ids
 * are the heading ids the pipeline already generated, which is what makes a
 * `#зачем-это` deep link land on the right panel (the controller maps anchors to
 * panels at boot).
 *
 * Runs on the rendered tree (`after`), not on mdast: by then every heading has
 * its final id and every block is a real element.
 */
import type { HastPluginDefinition, HastNode, PluginFactoryContext } from 'satteri';

/** Only post bodies get panels; every other collection is untouched. */
function isPost(pathname: string): boolean {
  return /\/src\/content\/posts(?:-en)?\//.test(pathname);
}

function isH2(node: HastNode): boolean {
  return (
    (node as { type?: string; tagName?: string }).type === 'element' &&
    (node as { tagName?: string }).tagName === 'h2'
  );
}

function propertiesOf(node: HastNode): Record<string, unknown> {
  return (node as { properties?: Record<string, unknown> }).properties ?? {};
}

function childrenOf(node: HastNode): HastNode[] {
  return (node as { children?: HastNode[] }).children ?? [];
}

function textOf(node: HastNode): string {
  const n = node as { value?: string; children?: HastNode[] };
  if (typeof n.value === 'string') return n.value;
  return (n.children ?? []).map(textOf).join(' ');
}

/** Mirrors `InnerTOC`'s `slugify`. Only a fallback: the pipeline gives every
 *  markdown heading an id, but a hand-written `<h2>` in the body would not. */
function slugify(text: string): string {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, '-')
    .replace(/[^a-z0-9Ѐ-ӿ\-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Panel ids are heading ids, so a tab and its panel can never disagree. A
 *  generated fallback must not claim an id a later heading already owns. */
function idFor(node: HastNode, reserved: Set<string>, used: Set<string>): string {
  const existing = propertiesOf(node).id;
  let id = typeof existing === 'string' ? existing : '';
  if (!id) {
    const base = slugify(textOf(node)) || 'section';
    id = base;
    let n = 1;
    while (reserved.has(id) || used.has(id)) id = `${base}-${n++}`;
  }
  used.add(id);
  return id;
}

function panel(id: string, nodes: HastNode[], hidden: boolean): HastNode {
  return {
    type: 'element',
    tagName: 'section',
    properties: {
      className: ['section-panel'],
      id: `panel-${id}`,
      'data-panel': id,
      role: 'tabpanel',
      'aria-labelledby': `tab-${id}`,
      tabIndex: 0,
      ...(hidden ? { hidden: true } : {}),
    },
    children: nodes,
  } as HastNode;
}

/** Factory for Sätteri's `hastPlugins`. */
export function postSections() {
  return (ctx: PluginFactoryContext): HastPluginDefinition | false => {
    if (ctx.sourceFormat !== 'markdown') return false;
    if (!isPost(ctx.fileURL?.pathname ?? '')) return false;

    return {
      name: 'post-sections',
      after(root, c) {
        const children = childrenOf(root);
        // One heading is not a dashboard: the tablist would be a single chip and
        // the noscript reveal would be the only thing it changes.
        if (children.filter(isH2).length < 2) return;

        const firstIdx = children.findIndex(isH2);
        if (firstIdx === -1) return;

        // Every authored id is reserved before a fallback can generate one.
        const reserved = new Set<string>();
        for (const node of children) {
          if (!isH2(node)) continue;
          const id = propertiesOf(node).id;
          if (typeof id === 'string') reserved.add(id);
        }

        const used = new Set<string>();
        const panels: { id: string; nodes: HastNode[] }[] = [];
        let current: { id: string; nodes: HastNode[] } | null = null;
        for (const node of children.slice(firstIdx)) {
          if (isH2(node)) {
            current = { id: idFor(node, reserved, used), nodes: [] };
            panels.push(current);
          }
          // `current` cannot be null here: the loop starts on an H2, and every
          // node after it either opens a new panel or joins the open one.
          current!.nodes.push(node);
        }

        // The lead (everything before the first H2 — a definition, a TL;DR)
        // opens the first panel instead of floating above the tablist, where it
        // would read as a second, tab-less intro.
        panels[0].nodes = [...children.slice(0, firstIdx), ...panels[0].nodes];

        c.setField(
          root as unknown as HastNode,
          'children',
          panels.map((p, i) => panel(p.id, p.nodes, i > 0)) as never,
        );
      },
    };
  };
}
