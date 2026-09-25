// docs/contact-log.md is the source of truth for outcome stages, and this script
// is the only thing that writes to it automatically. The failure that matters is
// a corrupted table (a raw `|` in a message splits the row) or a duplicated row
// (the short id is the only dedupe key). Both are asserted here, against the
// pure helpers — the network and the file write are not exercised.

import { describe, it, expect } from 'bun:test';
import { buildRow, cell, insertRows, seenIds } from '../../scripts/sync-contact-log.mjs';

const HEADER = '| date | source | company | segment | stage | evidence | next action |';
const SEPARATOR = '|---|---|---|---|---|---|---|';

const message = {
  id: 'ab12cd34-5678-90ab-cdef-1234567890ab',
  created_at: '2026-09-26T09:30:00.000Z',
  name: 'Никита',
  contact: 'tg:@lofinibo',
  company: 'Acme',
  message: 'привет, есть роль?',
  source: 'direct',
};

describe('cell', () => {
  it('collapses whitespace so a multi-line message cannot break the row', () => {
    expect(cell('a\n\n  b\tc ')).toBe('a b c');
  });

  it('escapes a pipe, the only character that splits a markdown table cell', () => {
    expect(cell('a | b')).toBe('a \\| b');
  });

  it('falls back to an em dash and truncates to the cap', () => {
    expect(cell('')).toBe('—');
    expect(cell(undefined)).toBe('—');
    expect(cell('abcdef', 4)).toBe('abc…');
  });
});

describe('buildRow', () => {
  const row = buildRow(message);

  it('emits the log schema, seven cells wide', () => {
    expect(row.split(' | ').length).toBe(7);
    expect(row.startsWith('| 2026-09-26 | direct | Acme | other |')).toBe(true);
  });

  it('records the inbound message as a `contact` stage row', () => {
    expect(row).toContain('| contact |');
  });

  it('carries the short id in evidence — the row links back to the table', () => {
    expect(row).toContain('#ab12cd34');
    expect(row).toContain('Никита (tg:@lofinibo)');
    expect(row).toContain('«привет, есть роль?»');
  });

  it('leaves segment and next action as an editable default', () => {
    expect(row).toMatch(/\| other \| contact \|.+\| reply \|$/);
  });
});

describe('seenIds', () => {
  it('reads 8-hex short ids and ignores everything else that starts with #', () => {
    const log = '| #ab12cd34 x | … |\n| #1 | #zzzzzzzz | no hash |';
    expect([...seenIds(log)]).toEqual(['ab12cd34']);
  });
});

describe('insertRows', () => {
  const fixture = `# Contact log\n\n## Log\n\n${HEADER}\n${SEPARATOR}\n| — | — | — | — | — | _no rows yet — awaiting first inbound contact_ | — |\n\n---\n\n## How this feeds the metrics\n`;

  it('replaces the placeholder once a real row exists, and keeps the rest verbatim', () => {
    const { log, added, droppedPlaceholder } = insertRows(fixture, [buildRow(message)]);
    expect(added).toBe(1);
    expect(droppedPlaceholder).toBe(true);
    expect(log).not.toContain('no rows yet');
    expect(log).toContain('#ab12cd34');
    expect(log).toContain('## How this feeds the metrics');
  });

  it('appends after the last data row without touching it', () => {
    const withRow = insertRows(fixture, [buildRow(message)]).log;
    const handEdited = withRow.replace('| reply |', '| screening |');
    const second = { ...message, id: 'ffffffff-0000-0000-0000-000000000000' };
    const { log } = insertRows(handEdited, [buildRow(second)]);
    expect(log).toContain('| screening |');
    expect(log.indexOf('#ab12cd34')).toBeLessThan(log.indexOf('#ffffffff'));
  });

  it('leaves the placeholder alone when there is nothing to add', () => {
    const { log, added } = insertRows(fixture, []);
    expect(added).toBe(0);
    expect(log).toContain('no rows yet');
  });

  it('refuses to write into a file whose table it cannot find', () => {
    expect(() => insertRows('# nothing here\n', [buildRow(message)])).toThrow(/header not found/);
  });
});
