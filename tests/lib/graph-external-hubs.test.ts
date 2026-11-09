// The content graph must be able to reach a sibling graph (the conference
// programme) through one declared hub, and must stay byte-identical when no
// hub is declared. Every branch that adds a node is a chance to break the
// graph invariants, so each guard gets one assertion.
import { describe, it, expect } from 'bun:test';
import { buildGraph, subgraphAround } from '../../src/lib/graph';
import { TOPICS } from '../../src/lib/topics';

const projects = [{ id: 'mm-program-page.md', data: { title: 'Программа', related: [] } }];

const hub = {
  id: 'event:program',
  label: 'Матемаркетинг 2026',
  url: 'talks/',
  section: 'talks',
  from: 'p:mm-program-page',
};

const build = (externalHubs?: (typeof hub)[]) =>
  buildGraph({ projects, posts: [], parts: [], topics: TOPICS, ...(externalHubs ? { externalHubs } : {}) });

describe('buildGraph externalHubs', () => {
  it('adds no hub node when the list is omitted', () => {
    expect(build().nodes.some((n) => n.id === 'event:program')).toBe(false);
  });

  it('wires the hub to its source node with a related edge', () => {
    const g = build([hub]);
    const node = g.nodes.find((n) => n.id === 'event:program');
    expect(node?.url).toBe('talks/');
    expect(node?.section).toBe('talks');
    expect(g.links.filter((l) => l.source === 'p:mm-program-page' && l.target === 'event:program')).toEqual([
      { source: 'p:mm-program-page', target: 'event:program', weight: 1, type: 'related' },
    ]);
  });

  it('skips a hub whose source node is absent (no orphan)', () => {
    expect(build([{ ...hub, from: 'p:does-not-exist' }]).nodes.some((n) => n.id === 'event:program')).toBe(false);
  });

  it('skips a hub with no url (every node must be navigable)', () => {
    expect(build([{ ...hub, url: '' }]).nodes.some((n) => n.id === 'event:program')).toBe(false);
  });

  it('survives into the project mini-graph', () => {
    const mini = subgraphAround(build([hub]), 'p:mm-program-page');
    expect(mini.nodes.some((n) => n.id === 'event:program')).toBe(true);
  });
});
