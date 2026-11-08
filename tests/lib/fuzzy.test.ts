import { describe, it, expect } from 'bun:test';
import { distanceWithin, wordsOf, typoBudget, bestWordIn, bestWordDistance } from '../../src/lib/fuzzy';

const d = (a: string, b: string, max = 2) => distanceWithin(a, b, max);

describe('distanceWithin', () => {
  it('returns the distance for exact and near matches', () => {
    expect(d('retention', 'retention')).toBe(0);
    expect(d('retenchion', 'retention')).toBe(2); // 2 edits
    expect(d('retantion', 'retention')).toBe(1); // 1 edit
  });

  it('returns Infinity past max / past the length gap', () => {
    expect(d('retention', 'retentionanalysis')).toBe(Infinity); // len diff 8
    expect(d('abcde', 'vwxyz')).toBe(Infinity); // 5 edits
    expect(d('abc', '')).toBe(Infinity); // 3 > max
  });

  it('handles empty strings', () => {
    expect(d('', '')).toBe(0);
    expect(d('ab', '')).toBe(2); // exactly at max
  });

  it('is symmetric and Cyrillic-safe (char-code based)', () => {
    expect(d('тест', 'тес')).toBe(1); // 1 deletion
    expect(d('аааа', 'аабб')).toBe(2); // 2 substitutions
  });
});

describe('typoBudget', () => {
  it('refuses to fuzzy-match short tokens', () => {
    expect(typoBudget('sql')).toBe(0);
    expect(typoBudget('crm')).toBe(0);
  });

  it('scales with length', () => {
    expect(typoBudget('crmm')).toBe(1);
    expect(typoBudget('когорты')).toBe(2);
    expect(typoBudget('analysis')).toBe(2);
  });
});

describe('wordsOf', () => {
  it('splits on punctuation and lowercases', () => {
    expect(wordsOf('Retention / когорты: A/B')).toEqual(['retention', 'когорты', 'a', 'b']);
  });
});

describe('bestWordIn', () => {
  it('finds a typo against an inflected form through the prefix rule', () => {
    // Plain LD("когорты", "когортный") is 2 (len gap); the first 7 chars differ
    // by one substitution, which is the read a searcher actually means.
    expect(bestWordIn('когорты', ['когортный', 'анализ'], 2)).toBe(1);
    expect(bestWordIn('retenchion', wordsOf('Retention / когорты'), 2)).toBe(2);
  });

  it('returns Infinity when no word is close', () => {
    expect(bestWordIn('zzqqq', ['когортный', 'анализ'], 1)).toBe(Infinity);
  });

  it('bestWordDistance works on raw text, and a clean prefix scores 0', () => {
    expect(bestWordDistance('cohorr', 'Cohort analysis', 1)).toBe(1);
    // A token that *is* the word's first chars is a prefix hit, not a typo.
    expect(bestWordDistance('cohor', 'Cohort analysis', 1)).toBe(0);
  });
});
