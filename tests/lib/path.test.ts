import { describe, it, expect, afterEach } from "bun:test";
import { withBase } from '../../src/lib/path';

const ORIGINAL_BASE_URL = import.meta.env.BASE_URL;

describe('withBase', () => {
  afterEach(() => {
    if (ORIGINAL_BASE_URL === undefined) {
      delete process.env.BASE_URL;
    } else {
      process.env.BASE_URL = ORIGINAL_BASE_URL;
    }
  });

  it('prepends the astro base and normalizes slashes', () => {
    process.env.BASE_URL = '/Personal_Projects.github.io/';
    expect(withBase('writing/')).toBe('/Personal_Projects.github.io/writing/');
  });

  it('strips a leading slash on the path', () => {
    process.env.BASE_URL = '/Personal_Projects.github.io/';
    expect(withBase('/about')).toBe('/Personal_Projects.github.io/about');
  });

  it('handles a root base', () => {
    process.env.BASE_URL = '/';
    expect(withBase('writing/')).toBe('/writing/');
  });

  // The talks graph hangs an external hub off the content graph; that node's
  // url is complete already, and prefixing it would produce `/https://…`.
  it('leaves absolute urls untouched', () => {
    process.env.BASE_URL = '/Personal_Projects.github.io/';
    for (const url of [
      'https://nikitaboyarkin.github.io/mm-program-page/',
      'http://example.com/x',
      '//cdn.example.com/x',
      'mailto:hi@example.com',
    ]) {
      expect(withBase(url)).toBe(url);
    }
  });
});