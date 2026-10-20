import { describe, it, expect } from "bun:test";
import { formatDate, estimateReadTime } from '../../src/lib/date';

describe('formatDate', () => {
  it('formats a Date as en-US medium', () => {
    expect(formatDate(new Date('2026-08-05T00:00:00Z'))).toBe('Aug 5, 2026');
  });

  it('accepts an ISO string', () => {
    expect(formatDate('2026-08-05')).toBe('Aug 5, 2026');
  });

  it('is independent of the reader timezone (date-only = calendar date)', () => {
    // A date-only frontmatter value parses as UTC midnight. Formatting it in the
    // reader's zone would show the previous day anywhere west of UTC, so the
    // function must pin itself to UTC. Bun honours a runtime TZ change.
    const original = process.env.TZ;
    try {
      process.env.TZ = 'America/Los_Angeles';
      expect(formatDate('2026-08-05')).toBe('Aug 5, 2026');
      expect(formatDate(new Date('2026-08-05T00:00:00Z'))).toBe('Aug 5, 2026');
      process.env.TZ = 'Pacific/Kiritimati'; // UTC+14
      expect(formatDate('2026-08-05')).toBe('Aug 5, 2026');
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

describe('estimateReadTime', () => {
  it('returns at least 1 minute', () => {
    expect(estimateReadTime('')).toBe(1);
    expect(estimateReadTime('one')).toBe(1);
  });

  it('rounds ~200 wpm', () => {
    const words = Array.from({ length: 400 }, () => 'word').join(' ');
    expect(estimateReadTime(words)).toBe(2);
  });
});