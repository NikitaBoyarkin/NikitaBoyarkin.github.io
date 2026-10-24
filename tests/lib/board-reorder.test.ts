import { describe, it, expect } from 'bun:test';
import { columnCount, insertionAfter } from '../../src/lib/board-reorder';

const RECT = { left: 0, top: 0, width: 400, height: 200 };
const CENTER = { x: 200, y: 100 };

describe('columnCount', () => {
  it('treats a flex container as one column', () => {
    expect(columnCount('none')).toBe(1);
    expect(columnCount('')).toBe(1);
    expect(columnCount('   ')).toBe(1);
  });

  it('counts resolved grid tracks', () => {
    expect(columnCount('366px')).toBe(1);
    expect(columnCount('540px 540px')).toBe(2);
    expect(columnCount('320px  320px  320px')).toBe(3);
  });
});

describe('insertionAfter', () => {
  it('decides by Y in a single column', () => {
    // X is irrelevant one column wide: the far-right pointer still lands
    // before the target when it is in its top half.
    expect(insertionAfter(1, { x: 399, y: 20 }, RECT)).toBe(false);
    expect(insertionAfter(1, { x: 399, y: 180 }, RECT)).toBe(true);
  });

  it('decides by X once the board wraps into columns', () => {
    // Y is irrelevant in a row: the bottom pointer still lands before the
    // target when it is to its left.
    expect(insertionAfter(2, { x: 20, y: 199 }, RECT)).toBe(false);
    expect(insertionAfter(2, { x: 380, y: 199 }, RECT)).toBe(true);
  });

  it('treats the exact centre as "before"', () => {
    expect(insertionAfter(1, CENTER, RECT)).toBe(false);
    expect(insertionAfter(2, CENTER, RECT)).toBe(false);
  });
});
