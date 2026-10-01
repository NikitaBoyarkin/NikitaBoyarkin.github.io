// Tooltip copy builders for the knowledge graph. Pure string functions (no
// DOM), so they're unit-testable; the same helper feeds the server-rendered
// SVG <title> elements (a11y / no-JS) and the client tooltip — the strings are
// precomputed into the kg-data blob, so the client never re-derives locale
// text.
import type { LinkType } from './graph';

export type NodeKind = 'core' | 'project' | 'post' | 'volta' | 'topic' | 'glossary';

/** Node kind from the id prefix scheme used by graph.ts. */
export function nodeKindOf(id: string): NodeKind {
  if (id.startsWith('core:')) return 'core';
  if (id.startsWith('p:')) return 'project';
  if (id.startsWith('post:')) return 'post';
  if (id.startsWith('vp:')) return 'volta';
  if (id.startsWith('topic:')) return 'topic';
  if (id.startsWith('g:')) return 'glossary';
  return 'project';
}

export interface TooltipCopy {
  kind: Record<NodeKind, string>;
  group: string;
  community: string;
  links: string;
  edgeType: Record<LinkType, string>;
  weight: string;
}

export function tooltipCopy(lang: 'ru' | 'en'): TooltipCopy {
  return lang === 'en'
    ? {
        kind: { core: 'Hub', project: 'Project', post: 'Post', volta: 'Volta module', topic: 'Topic', glossary: 'Glossary term' },
        group: 'Group / category',
        community: 'Community',
        links: 'links',
        edgeType: {
          related: 'Explicit link',
          children: 'Volta composition',
          topic: 'Thematic link',
          shared: 'Lateral link',
          core: 'Hub',
        },
        weight: 'weight',
      }
    : {
        kind: { core: 'Хаб', project: 'Проект', post: 'Запись', volta: 'Volta-модуль', topic: 'Тема', glossary: 'Термин словаря' },
        group: 'Трек / категория',
        community: 'Комьюнити',
        links: 'связей',
        edgeType: {
          related: 'Явная связь',
          children: 'Состав Volta',
          topic: 'Тематическая связь',
          shared: 'Латеральная связь',
          core: 'Хаб',
        },
        weight: 'вес',
      };
}

/** Undirected degree of every node (each edge counts once per endpoint). */
export function countDegrees(
  links: Array<{ source: string; target: string }>,
): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const l of links) {
    degrees.set(l.source, (degrees.get(l.source) ?? 0) + 1);
    degrees.set(l.target, (degrees.get(l.target) ?? 0) + 1);
  }
  return degrees;
}

export interface NodeTooltipInput {
  id: string;
  label: string;
  group: string;
  community: number;
  communityLabel?: string;
  degree: number;
}

/** Tooltip lines for a node: kind + group, community, degree. */
export function buildNodeTooltip(
  n: NodeTooltipInput,
  t: TooltipCopy,
): string[] {
  const lines = [n.label, `${t.kind[nodeKindOf(n.id)]} · ${t.group}: ${n.group}`];
  if (n.communityLabel) lines.push(`${t.community}: ${n.communityLabel}`);
  lines.push(`${n.degree} ${t.links}`);
  return lines;
}

export interface EdgeTooltipInput {
  type: string;
  weight: number;
  sourceLabel: string;
  targetLabel: string;
}

/** Tooltip lines for an edge: type name, endpoints, weight. */
export function buildEdgeTooltip(
  e: EdgeTooltipInput,
  t: TooltipCopy,
): string[] {
  return [
    t.edgeType[e.type as LinkType] ?? e.type,
    `${e.sourceLabel} → ${e.targetLabel}`,
    `${t.weight}: ${String(Number(e.weight.toFixed(2)))}`,
  ];
}

/**
 * Precompute every node/edge tooltip for a graph build. Returns two arrays
 * aligned with `nodes`/`links` by index, each element a list of lines. The
 * Astro component embeds them into kg-data and renders them in both the SVG
 * <title> and the interactive tooltip.
 */
export function buildGraphTooltips(
  nodes: Array<{
    id: string;
    label: string;
    group: string;
    community?: number;
    communityLabel?: string;
  }>,
  links: Array<{ source: string; target: string; type: string; weight: number }>,
  lang: 'ru' | 'en',
): { node: string[][]; edge: string[][] } {
  const t = tooltipCopy(lang);
  const labelById = new Map(nodes.map((n) => [n.id, n.label]));
  const degrees = countDegrees(links);
  const node = nodes.map((n) =>
    buildNodeTooltip(
      {
        id: n.id,
        label: n.label,
        group: n.group,
        community: n.community ?? 0,
        communityLabel: n.communityLabel,
        degree: degrees.get(n.id) ?? 0,
      },
      t,
    ),
  );
  const edge = links.map((l) =>
    buildEdgeTooltip(
      {
        type: l.type,
        weight: l.weight,
        sourceLabel: labelById.get(l.source) ?? l.source,
        targetLabel: labelById.get(l.target) ?? l.target,
      },
      t,
    ),
  );
  return { node, edge };
}
