// The export and invite scripts touch private data: an invite label is a
// person's name and company, and a response carries an ip_hash. The CSV column
// list is the one place that decides what leaves the database, so it is pinned
// here — a column added "for convenience" turns this red.

import { describe, it, expect } from 'bun:test';
import { EXPORT_COLUMNS, toCsv } from '../../scripts/feedback-export.mjs';
import { inviteUrl } from '../../scripts/feedback-invite.mjs';

describe('export columns', () => {
  it('exports the answers and never the identifying columns', () => {
    expect(EXPORT_COLUMNS).toEqual([
      'id',
      'created_at',
      'role',
      'source',
      'locale',
      'q_task',
      'q_helps',
      'q_friction',
      'q_gap',
      'q_more',
      'signature',
    ]);
    for (const forbidden of ['ip_hash', 'invite_id', 'label']) {
      expect(EXPORT_COLUMNS).not.toContain(forbidden);
    }
  });
});

describe('toCsv', () => {
  const row = {
    id: '1',
    created_at: '2026-11-17T10:00:00Z',
    role: 'hr',
    source: 'open',
    locale: 'ru',
    q_task: 'a, with comma',
    q_helps: 'a "quoted" word',
    q_friction: 'line one\nline two',
    q_gap: '',
    q_more: '',
    signature: 'Аня',
  };

  it('writes the header in export order', () => {
    expect(toCsv([row]).split('\n')[0]).toBe(EXPORT_COLUMNS.join(','));
  });

  it('quotes commas, quotes and newlines so the row does not break', () => {
    const csv = toCsv([row]);
    expect(csv).toContain('"a, with comma"');
    expect(csv).toContain('"a ""quoted"" word"');
    expect(csv).toContain('"line one\nline two"');
  });
});

describe('inviteUrl', () => {
  it('carries the token and role in the query, not the path', () => {
    expect(inviteUrl('ab12', 'hr')).toBe('https://nikitaboyarkin.github.io/feedback/?t=ab12&r=hr');
  });
});
