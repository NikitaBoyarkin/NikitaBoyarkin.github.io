// Deterministic hand-jitter for the canvas frame layer.
//
// The generated `d` strings are inlined into the built HTML, so a generator that
// drifts between runs would produce a different page on every build and would
// make the sketch layer untestable. The amplitude bound is asserted against a
// HARDCODED literal (2.5) rather than against the module's own JITTER, so that
// raising JITTER in src/lib/sketch.ts turns this file red — a test that read the
// constant it is checking could never bite.
import { describe, it, expect } from 'bun:test';
import {
  JITTER,
  PASSES,
  hashString,
  mulberry32,
  sketchRect,
  sketchRectFor,
} from '../../src/lib/sketch';

const MAX_JITTER = 2.5; // must exceed src JITTER (2.2) but stay tight

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('stays inside [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('hashString', () => {
  it('is stable and unsigned', () => {
    expect(hashString('role-hr')).toBe(hashString('role-hr'));
    expect(hashString('role-hr')).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(hashString('role-hr'))).toBe(true);
  });

  it('separates similar ids', () => {
    expect(hashString('role-hr')).not.toBe(hashString('role-manager'));
  });
});

describe('sketchRect', () => {
  it('emits one path per pass and four vertices per pass', () => {
    const r = sketchRect(320, 180, 1);
    expect(r.paths.length).toBe(PASSES);
    expect(r.points).toBe(4 * PASSES);
    for (const d of r.paths) {
      expect(d.startsWith('M')).toBe(true);
      expect(d.endsWith(' Z')).toBe(true);
    }
  });

  it('returns identical paths for the same seed', () => {
    expect(sketchRect(320, 180, 7)).toEqual(sketchRect(320, 180, 7));
  });

  it('returns different paths for different seeds', () => {
    expect(sketchRect(320, 180, 7).paths).not.toEqual(sketchRect(320, 180, 8).paths);
  });

  it('jitters — but never beyond the declared amplitude', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { amplitude } = sketchRect(320, 180, seed);
      expect(amplitude).toBeGreaterThan(0.5); // the generator is actually moving vertices
      expect(amplitude).toBeLessThanOrEqual(MAX_JITTER); // and staying bounded
    }
  });

  it('draws the exact rectangle when amplitude is 0, overshooting each corner', () => {
    // cx=50, cy=25, OVERSHOOT=1.06 → each corner is pushed 6% outward from centre.
    expect(sketchRect(100, 50, 1, 0).paths[0]).toBe(
      'M-3.00 -1.50 L103.00 -1.50 L103.00 51.50 L-3.00 51.50 Z'
    );
  });

  it('leaves the module JITTER inside the hardcoded bound', () => {
    // Guards the coupling: if JITTER grows past MAX_JITTER the amplitude test
    // above starts failing for an unobvious reason. Fail here, where it reads.
    expect(JITTER).toBeLessThanOrEqual(MAX_JITTER);
    expect(JITTER).toBeGreaterThan(0.5);
  });
});

describe('sketchRectFor', () => {
  it('seeds from the node id, so each frame draws its own stable shape', () => {
    expect(sketchRectFor('identity', 620, 210)).toEqual(sketchRectFor('identity', 620, 210));
    expect(sketchRectFor('identity', 620, 210).paths).not.toEqual(
      sketchRectFor('claim', 620, 120).paths
    );
  });

  it('equals sketchRect at the id-derived seed, so there is one generator', () => {
    expect(sketchRectFor('role-hr', 540, 180)).toEqual(
      sketchRect(540, 180, hashString('role-hr'))
    );
  });
});
