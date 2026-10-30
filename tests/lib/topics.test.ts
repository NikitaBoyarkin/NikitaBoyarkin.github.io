import { describe, it, expect } from "bun:test";
import {
  computeTopicRows,
  groupRowsByLevel,
  TOPICS,
  normalizeTopicKey,
  projectMatchesTopic,
} from '../../src/lib/topics';

const post = (tags: string[]) => ({
  id: 'x.md',
  data: { tags, tools: [], title: 'x', description: 'x' },
});
const project = (slug: string, extra: Partial<{ tools: string[]; description: string; title: string }> = {}) => ({
  id: `${slug}.md`,
  data: { tags: [], tools: extra.tools ?? [], title: extra.title ?? slug, description: extra.description ?? '' },
});

describe('TOPICS', () => {
  it('matches tags to their topic', () => {
    const ab = TOPICS.find((t) => t.key === 'ab-testing')!;
    expect(ab.match('bayesian')).toBe(true);
    expect(ab.match('sql')).toBe(false);
  });
});

describe('normalizeTopicKey', () => {
  it('folds slashes, every dash variant and whitespace into one spelling', () => {
    expect(normalizeTopicKey('A/B-тест')).toBe('a b тест');
    expect(normalizeTopicKey('A/B тест')).toBe('a b тест');
    expect(normalizeTopicKey('ab-testing')).toBe('ab testing');
    expect(normalizeTopicKey('  North   Star ')).toBe('north star');
    expect(normalizeTopicKey('a—b–c')).toBe('a b c');
  });
});

describe('projectMatchesTopic', () => {
  const ab = TOPICS.find((t) => t.key === 'ab-testing')!;

  it('matches the `ab.md` project titled "A/B-тест" — /topics/ab-testing/ is not empty', () => {
    const abProject = project('ab', { title: 'A/B-тест' });
    expect(projectMatchesTopic(ab, abProject)).toBe(true);
    // The hub computes with the same predicate, so the count agrees.
    const rows = computeTopicRows([], [abProject]);
    expect(rows.find((r) => r.key === 'ab-testing')?.count).toBe(1);
  });

  it('matches the shipped `ab.md` frontmatter (English A/B Testing title)', () => {
    const shipped = project('ab', { title: 'A/B Testing Methodology Toolkit', tools: ['Python', 'uv'] });
    expect(projectMatchesTopic(ab, shipped)).toBe(true);
  });

  it('still matches hyphenated tags and prose spellings', () => {
    expect(projectMatchesTopic(ab, project('x', { description: 'ab-testing pipeline' }))).toBe(true);
    expect(projectMatchesTopic(ab, project('x', { title: 'AB testing toolkit' }))).toBe(true);
    expect(projectMatchesTopic(ab, project('x', { title: 'Retention cohorts' }))).toBe(false);
  });

  it('does not match on a normalised alias shorter than 3 characters', () => {
    const topic = {
      ...ab,
      key: 'ab',
      tags: ['ab'],
    };
    expect(projectMatchesTopic(topic, project('x', { description: 'ab' }))).toBe(false);
  });
});

describe('computeTopicRows', () => {
  it('counts posts by tag and drops zero-count topics', () => {
    const rows = computeTopicRows(
      [post(['ab-testing']), post(['retention', 'cohort-analysis'])],
      [project('sql')],
    );
    const sql = rows.find((r) => r.key === 'sql');
    const ab = rows.find((r) => r.key === 'ab-testing');
    const automation = rows.find((r) => r.key === 'automation');
    expect(ab?.count).toBe(1);
    expect(sql?.count).toBe(1);
    expect(automation).toBeUndefined();
  });

  it('matches projects via description signals', () => {
    const rows = computeTopicRows([], [project('volta', { description: 'retention funnel segmentation' })]);
    expect(rows.find((r) => r.key === 'retention')?.count).toBe(1);
    expect(rows.find((r) => r.key === 'segmentation')?.count).toBe(1);
  });

  it('counts a post once per topic even when it carries several of its tags', () => {
    // `ab-testing` matches ab-testing, bayesian and statistics — the same post.
    const rows = computeTopicRows([post(['ab-testing', 'bayesian', 'statistics'])], []);
    expect(rows.find((r) => r.key === 'ab-testing')?.count).toBe(1);
  });

  it('project count agrees with the predicate the topic page renders with', () => {
    const projects = [
      project('volta', { description: 'retention funnel segmentation' }),
      project('ab', { title: 'A/B testing toolkit', description: 'CUPED and mSPRT' }),
      project('sql', { tools: ['SQL'] }),
    ];
    const rows = computeTopicRows([], projects);
    for (const topic of TOPICS) {
      const expected = projects.filter((p) => projectMatchesTopic(topic, p)).length;
      const count = rows.find((r) => r.key === topic.key)?.count ?? 0;
      expect({ key: topic.key, count }).toEqual({ key: topic.key, count: expected });
    }
  });

  it('sorts rows by count desc', () => {
    const rows = computeTopicRows(
      [post(['sql']), post(['ab-testing']), post(['ab-testing']), post(['retention'])],
      [],
    );
    const counts = rows.map((r) => r.count);
    expect([...counts]).toEqual([...counts].sort((a, b) => b - a));
  });
});

describe('groupRowsByLevel', () => {
  it('groups rows preserving junior→meta order', () => {
    const rows = computeTopicRows(
      [post(['sql']), post(['ab-testing']), post(['portfolio'])],
      [],
    );
    const groups = groupRowsByLevel(rows);
    expect(groups.map((g) => g.level)).toEqual(['junior', 'middle', 'meta']);
  });
});