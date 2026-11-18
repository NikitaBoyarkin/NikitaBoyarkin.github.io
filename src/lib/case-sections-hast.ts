/**
 * Cuts a project case body into the panels of the nested dashboard.
 *
 * The page wraps `<Content />` in a `<SectionTabs size="sm">`, but the body
 * arrives as one block, so something has to draw the panel boundaries. Doing it
 * in the markdown pipeline keeps the page server-rendered: every word ships in
 * the HTML, the tablist is plain markup, and with JS off the `<noscript>` rule in
 * `SectionTabs.astro` reveals all panels again.
 *
 * Runs on the rendered tree (`after`), not on mdast: by then every heading has
 * its final id and every block is a real element, so the boundary is "insert a
 * `<section>` before this `h2`" rather than surgery on nodes later plugins may
 * still rewrite.
 *
 * Group membership comes from `groupForHeading` — the same table the page uses to
 * build its tab bar, so a tab and its panel cannot disagree.
 */
import type { HastPluginDefinition, HastNode, PluginFactoryContext } from 'satteri';

import { CASE_GROUP_ORDER, groupForHeading, type CaseGroup, type CaseLang } from './case-sections';

/** Only project bodies get panels; every other collection is untouched. */
function langForFile(pathname: string): CaseLang | null {
  if (/\/src\/content\/projects-en\//.test(pathname)) return 'en';
  if (/\/src\/content\/projects\//.test(pathname)) return 'ru';
  return null;
}

function isH2(node: HastNode): boolean {
  return (node as { type?: string; tagName?: string }).type === 'element' &&
    (node as { tagName?: string }).tagName === 'h2';
}

function headingText(node: HastNode): string {
  // ponytail: text children only — no case heading carries inline markup today;
  // walk the tree if one ever ships `<code>` in a title.
  const children = (node as { children?: HastNode[] }).children ?? [];
  return children
    .map((child) => (child as { value?: string }).value ?? '')
    .join(' ')
    .trim();
}

/** One dashboard panel. A plain hast element: the `{ raw }` escape hatch of the
 *  mdast phase parses to exactly one element and cannot express an open/close
 *  pair, so the boundaries are drawn by rebuilding the child list. */
function panel(group: CaseGroup, nodes: HastNode[], hidden: boolean): HastNode {
  const id = `case-${group}`;
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
export function caseSections() {
  return (ctx: PluginFactoryContext): HastPluginDefinition | false => {
    if (ctx.sourceFormat !== 'markdown') return false;
    const lang = langForFile(ctx.fileURL?.pathname ?? '');
    if (!lang) return false;

    return {
      name: 'case-sections',
      after(root, c) {
        const children = (root as unknown as { children?: HastNode[] }).children ?? [];
        const headings = children.filter(isH2);
        if (!headings.length) return;

        // Collected by group, not by contiguous run: `volta` returns to a group
        // after leaving it (`Ограничения` … `Интерактивный борд` … `Документация`),
        // and one panel per run would emit `case-docs` twice — duplicate ids and
        // a tab whose `aria-controls` lands on the first copy. Panels are emitted
        // in tab order instead, each holding its sections in document order.
        const leadGroup = groupForHeading(headingText(headings[0]), lang);
        const byGroup = new Map<CaseGroup, HastNode[]>();
        let current: CaseGroup | null = null;
        for (const node of children) {
          if (isH2(node)) current = groupForHeading(headingText(node), lang);
          const group = current ?? leadGroup;
          const bucket = byGroup.get(group);
          if (bucket) bucket.push(node);
          else byGroup.set(group, [node]);
        }

        c.setField(
          root as unknown as HastNode,
          'children',
          CASE_GROUP_ORDER.filter((group) => byGroup.has(group)).map((group, i) =>
            panel(group, byGroup.get(group)!, i > 0),
          ) as never,
        );
      },
    };
  };
}
