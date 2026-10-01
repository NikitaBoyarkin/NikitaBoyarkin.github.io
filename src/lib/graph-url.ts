// URL state for the knowledge graph: the color mode (taxonomy groups vs
// emergent communities), the per-mode hidden sets and the hidden edge types, so
// a filtered or community view survives reload and can be shared as a link,
// e.g. /graph/?mode=community&hideGroups=topic&hideC=2,3&hideEdges=topic,shared
// Pure string functions — no DOM — so they're unit-testable in bun:test.
export interface GraphUrlState {
  mode: 'group' | 'community';
  /** Hidden taxonomy group names (applies in group mode). */
  hiddenGroups: string[];
  /** Hidden community ids (applies in community mode). */
  hiddenCommunities: number[];
  /** Edge types hidden by the "Edges" filter (mode-independent). */
  hiddenEdges: string[];
  /** Quick-view preset: filter to a single node kind ('project' | 'post' |
   *  'topic' | 'volta' | 'glossary'), or null for everything. */
  preset: 'project' | 'post' | 'topic' | 'volta' | 'glossary' | null;
}

const MODE_PARAM = 'mode';
const HIDE_GROUPS_PARAM = 'hideGroups';
const HIDE_COMMUNITIES_PARAM = 'hideC';
const HIDE_EDGES_PARAM = 'hideEdges';
const PRESET_PARAM = 'preset';

/** Serialize state into a query string (leading `?`, or `''` when every value
 *  is the default). Merges into `existing` search so unrelated params (e.g.
 *  analytics tags) survive a sync. */
export function encodeGraphState(state: GraphUrlState, existing: string = ''): string {
  const p = new URLSearchParams(existing);
  if (state.mode === 'community') p.set(MODE_PARAM, 'community');
  else p.delete(MODE_PARAM);
  if (state.hiddenGroups.length) p.set(HIDE_GROUPS_PARAM, state.hiddenGroups.join(','));
  else p.delete(HIDE_GROUPS_PARAM);
  if (state.hiddenCommunities.length) p.set(HIDE_COMMUNITIES_PARAM, state.hiddenCommunities.join(','));
  else p.delete(HIDE_COMMUNITIES_PARAM);
  if (state.hiddenEdges.length) p.set(HIDE_EDGES_PARAM, state.hiddenEdges.join(','));
  else p.delete(HIDE_EDGES_PARAM);
  if (state.preset) p.set(PRESET_PARAM, state.preset);
  else p.delete(PRESET_PARAM);
  const q = p.toString();
  return q ? `?${q}` : '';
}

/** Parse a query string (without the leading `?` it's still fine — URLSearchParams
 *  tolerates it) into state. Unknown params are ignored, malformed values dropped,
 *  and an empty search yields the defaults. */
export function decodeGraphState(search: string): GraphUrlState {
  const p = new URLSearchParams(search);
  const mode = p.get(MODE_PARAM) === 'community' ? 'community' : 'group';
  const hiddenGroups = (p.get(HIDE_GROUPS_PARAM) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const hiddenCommunities = (p.get(HIDE_COMMUNITIES_PARAM) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  const hiddenEdges = (p.get(HIDE_EDGES_PARAM) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const presetRaw = p.get(PRESET_PARAM);
  const preset =
    presetRaw === 'project' ||
    presetRaw === 'post' ||
    presetRaw === 'topic' ||
    presetRaw === 'volta' ||
    presetRaw === 'glossary'
      ? presetRaw
      : null;
  return { mode, hiddenGroups, hiddenCommunities, hiddenEdges, preset };
}
