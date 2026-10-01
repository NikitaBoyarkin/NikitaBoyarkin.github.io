import { describe, it, expect } from "bun:test";
import { decodeGraphState, encodeGraphState } from '../../src/lib/graph-url';

const EMPTY = {
  mode: 'group' as const,
  hiddenGroups: [],
  hiddenCommunities: [],
  hiddenEdges: [],
  preset: null,
};

describe('decodeGraphState', () => {
  it('returns the defaults for an empty search', () => {
    expect(decodeGraphState('')).toEqual(EMPTY);
    expect(decodeGraphState('?utm_source=x')).toEqual(EMPTY);
  });

  it('parses community mode plus hidden sets and edge types', () => {
    expect(decodeGraphState('?mode=community&hideGroups=topic,note&hideC=2,3&hideEdges=topic,shared')).toEqual({
      mode: 'community',
      hiddenGroups: ['topic', 'note'],
      hiddenCommunities: [2, 3],
      hiddenEdges: ['topic', 'shared'],
      preset: null,
    });
  });

  it('parses a quick-view preset', () => {
    expect(decodeGraphState('?preset=post').preset).toBe('post');
    expect(decodeGraphState('?preset=volta&mode=community').preset).toBe('volta');
  });

  it('accepts the glossary preset', () => {
    expect(decodeGraphState('?preset=glossary').preset).toBe('glossary');
    expect(encodeGraphState({ ...EMPTY, preset: 'glossary' })).toBe('?preset=glossary');
  });

  it('drops unknown preset values and missing preset as null', () => {
    expect(decodeGraphState('?preset=banana').preset).toBe(null);
    expect(decodeGraphState('?preset=').preset).toBe(null);
    expect(decodeGraphState('').preset).toBe(null);
  });

  it('treats missing or unknown mode as group', () => {
    expect(decodeGraphState('?mode=banana&hideGroups=topic').mode).toBe('group');
    expect(decodeGraphState('?mode=x').mode).toBe('group');
  });

  it('drops malformed entries', () => {
    expect(decodeGraphState('?hideGroups=,topic,,note&hideC=2,,x,3&hideEdges=,core,,topic')).toEqual({
      mode: 'group',
      hiddenGroups: ['topic', 'note'],
      hiddenCommunities: [2, 3],
      hiddenEdges: ['core', 'topic'],
      preset: null,
    });
  });
});

describe('encodeGraphState', () => {
  it('returns an empty string for the default state', () => {
    expect(encodeGraphState(EMPTY)).toBe('');
  });

  it('serializes mode, both hidden sets and hidden edge types', () => {
    const q = encodeGraphState({
      mode: 'community',
      hiddenGroups: ['topic'],
      hiddenCommunities: [2, 3],
      hiddenEdges: ['topic', 'shared'],
      preset: null,
    });
    // URLSearchParams percent-encodes the comma separator inside a value;
    // decode still splits it back into the separate entries.
    expect(q).toBe('?mode=community&hideGroups=topic&hideC=2%2C3&hideEdges=topic%2Cshared');
  });

  it('serializes a preset and drops it when returning to all', () => {
    expect(encodeGraphState({ ...EMPTY, preset: 'project' })).toBe('?preset=project');
    // URLSearchParams keeps an existing key's position when `set` updates it,
    // so a stale `preset` in the old search keeps its slot in the output.
    expect(
      encodeGraphState(
        { mode: 'community', hiddenGroups: [], hiddenCommunities: [], hiddenEdges: [], preset: 'volta' },
        '?preset=project&utm=x',
      ),
    ).toBe('?preset=volta&utm=x&mode=community');
  });

  it('merges into existing search and keeps unrelated params', () => {
    const q = encodeGraphState(
      { mode: 'community', hiddenGroups: ['topic'], hiddenCommunities: [2], hiddenEdges: ['core'], preset: null },
      '?utm_source=x&mode=group',
    );
    expect(q).toBe('?utm_source=x&mode=community&hideGroups=topic&hideC=2&hideEdges=core');
  });

  it('drops stale params when state returns to defaults', () => {
    const q = encodeGraphState(
      { mode: 'group', hiddenGroups: [], hiddenCommunities: [], hiddenEdges: [], preset: null },
      '?mode=community&hideGroups=topic&hideC=2&hideEdges=core&preset=post&utm=x',
    );
    expect(q).toBe('?utm=x');
  });

  it('round-trips through decode', () => {
    const state = {
      mode: 'community' as const,
      hiddenGroups: ['topic', 'note'],
      hiddenCommunities: [3],
      hiddenEdges: ['shared'],
      preset: 'post' as const,
    };
    expect(decodeGraphState(encodeGraphState(state, '?utm=1'))).toEqual(state);
  });
});
