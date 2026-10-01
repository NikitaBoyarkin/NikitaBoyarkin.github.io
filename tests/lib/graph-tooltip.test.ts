import { describe, it, expect } from "bun:test";
import {
  buildEdgeTooltip,
  buildGraphTooltips,
  buildNodeTooltip,
  countDegrees,
  nodeKindOf,
  tooltipCopy,
} from '../../src/lib/graph-tooltip';

describe('nodeKindOf', () => {
  it('maps the id prefix scheme to a kind', () => {
    expect(nodeKindOf('core:projects')).toBe('core');
    expect(nodeKindOf('p:volta')).toBe('project');
    expect(nodeKindOf('post:ab-calibration')).toBe('post');
    expect(nodeKindOf('vp:funnel')).toBe('volta');
    expect(nodeKindOf('topic:ab-testing')).toBe('topic');
    expect(nodeKindOf('g:cuped')).toBe('glossary');
  });

  it('falls back for unknown ids', () => {
    expect(nodeKindOf('some-node')).toBe('project');
  });
});

describe('countDegrees', () => {
  it('counts both endpoints of every edge', () => {
    const deg = countDegrees([
      { source: 'a', target: 'b' },
      { source: 'a', target: 'c' },
      { source: 'c', target: 'a' },
    ]);
    expect(deg.get('a')).toBe(3);
    expect(deg.get('b')).toBe(1);
    expect(deg.get('c')).toBe(2);
  });
});

describe('tooltipCopy', () => {
  it('localizes per language', () => {
    expect(tooltipCopy('ru').kind.project).toBe('Проект');
    expect(tooltipCopy('en').kind.topic).toBe('Topic');
    expect(tooltipCopy('ru').edgeType.shared).toBe('Латеральная связь');
    expect(tooltipCopy('en').edgeType.core).toBe('Hub');
  });
});

describe('buildNodeTooltip', () => {
  const t = tooltipCopy('ru');

  it('lists label, kind + group, community and degree', () => {
    const lines = buildNodeTooltip(
      {
        id: 'post:ab-calibration',
        label: 'Калибровка A/B',
        group: 'note',
        community: 1,
        communityLabel: 'Тулкит',
        degree: 3,
      },
      t,
    );
    expect(lines).toEqual([
      'Калибровка A/B',
      'Запись · Трек / категория: note',
      'Комьюнити: Тулкит',
      '3 связей',
    ]);
  });

  it('omits the community line when the cluster has no label', () => {
    const lines = buildNodeTooltip(
      { id: 'p:volta', label: 'Volta', group: 'experiments', community: 0, degree: 1 },
      t,
    );
    expect(lines).toEqual(['Volta', 'Проект · Трек / категория: experiments', '1 связей']);
  });
});

describe('buildEdgeTooltip', () => {
  it('describes type, endpoints and weight in English', () => {
    const en = tooltipCopy('en');
    expect(
      buildEdgeTooltip({ type: 'shared', weight: 0.7, sourceLabel: 'A', targetLabel: 'B' }, en),
    ).toEqual(['Lateral link', 'A → B', 'weight: 0.7']);
  });

  it('falls back to the raw type for unknown types', () => {
    expect(
      buildEdgeTooltip({ type: 'mystery', weight: 1, sourceLabel: 'A', targetLabel: 'B' }, tooltipCopy('ru')),
    ).toEqual(['mystery', 'A → B', 'вес: 1']);
  });
});

describe('buildGraphTooltips', () => {
  it('returns arrays aligned with nodes and links', () => {
    const nodes = [
      { id: 'p:a', label: 'A', group: 'analytics', community: 0, communityLabel: 'Cluster' },
      { id: 'topic:b', label: 'B', group: 'topic', community: 0, communityLabel: 'Cluster' },
    ];
    const links = [
      { source: 'p:a', target: 'topic:b', type: 'topic' as const, weight: 0.5 },
    ];
    const { node, edge } = buildGraphTooltips(nodes, links, 'en');
    expect(node).toHaveLength(2);
    expect(edge).toHaveLength(1);
    expect(node[0][node[0].length - 1]).toBe('1 links');
    expect(edge[0]).toEqual(['Thematic link', 'A → B', 'weight: 0.5']);
  });
});
