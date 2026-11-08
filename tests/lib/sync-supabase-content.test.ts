// The sync writes into tables the analytics views join against, so the failure
// that matters is a row that cannot be matched back: a wrong slug (a Volta
// chapter colliding with a project), a missing EN locale, or a post with no
// published_at. All three are asserted here, against the pure helpers — the
// network is not exercised.

import { describe, it, expect } from 'bun:test';
import { postRows, projectRows, splitFrontmatter } from '../../scripts/sync-supabase-content.mjs';

const registry = {
  projects: [
    {
      slug: 'ab',
      track: 'experiments',
      title: 'A/B',
      title_en: 'A/B',
      description: 'ru',
      description_en: 'en',
      tools: ['Python'],
      private: false,
    },
  ],
  volta_cases: [
    {
      slug: 'ab',
      title: 'Volta — A/B',
      title_en: 'Volta — A/B',
      description: 'ru',
      description_en: 'en',
      href: 'https://nikitaboyarkin.github.io/projects/volta/ab/',
      github: 'https://github.com/NikitaBoyarkin/case-ab',
    },
  ],
};

const post = `---
title: "Проба"
date: 2026-08-05
category: guide
tags:
  - ab-testing
excerpt: "коротко"
---
body`;

describe('splitFrontmatter', () => {
  it('parses YAML between the fences', () => {
    expect(splitFrontmatter(post)).toMatchObject({ title: 'Проба', category: 'guide' });
  });

  it('returns an empty object when there is no frontmatter', () => {
    expect(splitFrontmatter('just body')).toEqual({});
  });
});

describe('projectRows', () => {
  const rows = projectRows(registry);

  it('emits one row per locale', () => {
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.locale).sort()).toEqual(['en', 'en', 'ru', 'ru']);
  });

  it('prefixes a Volta chapter so it cannot collide with a project slug', () => {
    const slugs = rows.map((row) => row.slug);
    expect(slugs).toContain('volta-ab');
    expect(slugs.filter((slug) => slug === 'ab')).toHaveLength(2);
  });

  it('falls back to the ru text when the EN field is missing', () => {
    const [ru, en] = projectRows({ projects: [{ slug: 'x', title: 'Имя', description: 'd' }], volta_cases: [] });
    expect(en.title).toBe('Имя');
    expect(en.description).toBe('d');
    expect(ru.track).toBe('analytics');
  });

  it('carries the Volta chapter link as the demo column', () => {
    const chapter = rows.find((row) => row.slug === 'volta-ab');
    expect(chapter.demo).toBe('https://nikitaboyarkin.github.io/projects/volta/ab/');
    expect(chapter.github).toBe('https://github.com/NikitaBoyarkin/case-ab');
  });
});

describe('postRows', () => {
  const [row] = postRows([{ slug: 'proba', locale: 'ru', source: post }]);

  it('normalises the date to an ISO timestamp Postgres accepts', () => {
    expect(row.published_at).toBe('2026-08-05T00:00:00.000Z');
  });

  it('keeps tags as a text array and defaults draft to false', () => {
    expect(row.tags).toEqual(['ab-testing']);
    expect(row.draft).toBe(false);
  });

  it('does not invent a date when the post has none', () => {
    const [bare] = postRows([{ slug: 'bare', locale: 'en', source: '---\ntitle: x\n---' }]);
    expect(bare.published_at).toBeNull();
  });
});
