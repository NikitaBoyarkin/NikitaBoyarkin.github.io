// An invite token rides in the URL as `?t=…&r=…`. PostHog captures
// `$current_url` on every pageview, so without this the token would sit in the
// analytics project forever. The sanitizer is the single place that removes it.

import { describe, it, expect } from 'bun:test';
import { stripFeedbackParams } from '../../src/lib/analytics';

describe('stripFeedbackParams', () => {
  it('drops the invite token and role, keeping the path', () => {
    expect(stripFeedbackParams('https://nikitaboyarkin.github.io/feedback/?t=abc&r=hr')).toBe(
      'https://nikitaboyarkin.github.io/feedback/',
    );
  });

  it('keeps unrelated query parameters such as campaign tags', () => {
    expect(stripFeedbackParams('https://nikitaboyarkin.github.io/feedback/?utm_source=x&t=abc')).toBe(
      'https://nikitaboyarkin.github.io/feedback/?utm_source=x',
    );
  });

  it('returns any other URL untouched', () => {
    const url = 'https://nikitaboyarkin.github.io/hire/?t=keep';
    expect(stripFeedbackParams(url)).toBe(url);
  });
});
