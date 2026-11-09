// Contract for the /talks/ talk-card payload (lib/talk-cards.ts).
//
// The dialog reads this array by index: `prev`/`next` are `i ± 1`, so the order
// here IS the user-visible navigation order. If `programmeOrder` drifted from
// the programme panel, every "next talk" button would walk a different sequence
// than the list it was opened from — silently, because both are sorted.

import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTalkCards } from '../../src/lib/talk-cards';
import type { TalksData, TalksOverlay } from '../../src/lib/talks-graph';

const read = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, '..', '..', 'src', 'data', name), 'utf-8'));

const DATA = read('talks.json') as TalksData;
const OVERLAY = read('talks-en.json') as TalksOverlay;
const DAY_INDEX = new Map(DATA.days.map((d, i) => [d.id, i]));

describe('talk cards', () => {
  it('covers every talk exactly once', () => {
    const cards = buildTalkCards(DATA);
    expect(cards.length).toBe(DATA.talks.length);
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
  });

  it('orders cards like the programme panel, so prev/next walk the same list', () => {
    const cards = buildTalkCards(DATA);
    // The rule restated here (day order → start → title), not read back from
    // `programmeOrder`: comparing that function to itself passes whatever it
    // does, so a dropped tie-break would leave prev/next walking a different
    // sequence than the programme list with this suite still green.
    const expected = [...DATA.talks]
      .sort(
        (a, b) =>
          (DAY_INDEX.get(a.dayId) ?? DATA.days.length) -
            (DAY_INDEX.get(b.dayId) ?? DATA.days.length) ||
          a.start.localeCompare(b.start) ||
          a.title.localeCompare(b.title, 'ru'),
      )
      .map((t) => t.id);
    expect(cards.map((c) => c.id)).toEqual(expected);
  });

  it('marks a talk with no track as null instead of an empty string', () => {
    const untracked = DATA.talks.find((t) => !t.trackName)!;
    const card = buildTalkCards(DATA).find((c) => c.id === untracked.id)!;
    expect(card.track).toBeNull();
    // Analytics keys on the slug, so an untracked talk must not carry `''`.
    expect(card.trackSlug).toBeNull();
  });

  it('carries the stable track slug next to the localized label', () => {
    const tracked = DATA.talks.find((t) => t.trackName)!;
    const card = buildTalkCards(DATA, 'en', OVERLAY).find((c) => c.id === tracked.id)!;
    // The label may be translated; the slug is what both locales share.
    expect(card.trackSlug).toBe(tracked.trackSlug);
    expect(card.trackSlug!.length).toBeGreaterThan(0);
  });

  it('labels every theme that the card carries', () => {
    const labels = new Map(DATA.themes.map((th) => [th.id, th.label]));
    for (const card of buildTalkCards(DATA)) {
      for (const theme of card.themes) expect(theme.label).toBe(labels.get(theme.id)!);
    }
  });

  it('uses the EN overlay titles and track names when it has them', () => {
    const en = buildTalkCards(DATA, 'en', OVERLAY);
    const translated = DATA.talks.find((t) => OVERLAY.talkTitles?.[String(t.id)]?.trim());
    if (translated) {
      const card = en.find((c) => c.id === translated.id)!;
      expect(card.title).toBe(OVERLAY.talkTitles![String(translated.id)]);
    }
    // No translation → RU title, never an empty heading in the dialog.
    const untranslated = DATA.talks.find((t) => !OVERLAY.talkTitles?.[String(t.id)]?.trim());
    if (untranslated) {
      const card = en.find((c) => c.id === untranslated.id)!;
      expect(card.title).toBe(untranslated.title);
    }
    for (const card of en) expect(card.title.length).toBeGreaterThan(0);
  });
});
