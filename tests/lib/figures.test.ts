import { describe, it, expect } from 'bun:test';

import { splitFigures, isFigureToken } from '../../src/lib/figures';

// The contract every surface shares: which numerals in running text are
// figures. If this drifts, a case study's numbers and an article's numbers stop
// being coloured by the same rule — which is exactly what the shared module
// exists to prevent.

describe('splitFigures — what counts as a figure', () => {
  const cases: Array<[string, string[]]> = [
    ['+5,72 п.п. конверсии', ['+5,72']],
    ['€208,5K за 12 мес', ['€208,5K']],
    ['13,9× ROI', ['13,9×']],
    ['95% ДИ [+6,21; +11,96]', ['95%', '+6,21', '+11,96']],
    ['p = 0,29–0,70', ['0,29–0,70']],
    ['52–55% в когорте', ['52–55%']],
    ['lift ≥ 5 п.п.', []],
    ['23 проекта в портфолио', []],
    ['2025 год', []],
    ['Улика №3 — Retention', []],
    ['M3-удержание выросло', []],
    ['A/B-тест на трёх группах', []],
    // Dotted dates are the one shape that looks like a decimal and is not: the
    // LinkedIn case states its window as «12.10.2025 — 11.10.2026».
    ['за окно 12.10.2025 — 11.10.2026', []],
    ['релиз 14.02.2024, затем 01.03.2024', []],
    ['метрика 2024-01-15', []],
    // A compact range of dates must not leak its second half, and a spaced dash
    // must not split a range in two.
    ['окно 12.10.2025–11.10.2026', []],
    ['52 – 55% в когорте', ['52 – 55%']],
    ['52  –  55% в когорте', ['52  –  55%']],
    ['2025–2026', []],
    ['5–10 п.п.', []],
    ['0.60 и 93.7%', ['0.60', '93.7%']],
  ];

  for (const [input, expected] of cases) {
    it(`marks ${JSON.stringify(expected)} in ${JSON.stringify(input)}`, () => {
      expect(splitFigures(input).filter((s) => s.figure).map((s) => s.text)).toEqual(expected);
    });
  }

  it('keeps plain runs around a figure', () => {
    expect(splitFigures('Итог: +5,72 п.п.')).toEqual([
      { text: 'Итог: ', figure: false },
      { text: '+5,72', figure: true },
      { text: ' п.п.', figure: false },
    ]);
  });

  it('reproduces the input exactly when the spans are joined', () => {
    const inputs = [
      '',
      'без чисел',
      'M3-удержание +9,09 п.п. (95% ДИ [+6,21; +11,96]), p = 0,29–0,70',
      '€208,5K за 12 мес при 13,9× ROI и 1\u00A0200 пользователях',
      'Улика №4 — сегментация: 2025, 3 группы, A/B',
    ];
    for (const input of inputs) {
      expect(splitFigures(input).map((s) => s.text).join('')).toBe(input);
    }
  });

  it('returns no spans for empty input', () => {
    expect(splitFigures('')).toEqual([]);
  });
});

describe('isFigureToken', () => {
  it('accepts measurements', () => {
    for (const token of ['+5,72', '€208,5', '13,9×', '95%', '0,29', '−3']) {
      expect(isFigureToken(token)).toBe(true);
    }
  });

  it('rejects bare counts and years', () => {
    for (const token of ['23', '2025', '3', '12']) {
      expect(isFigureToken(token)).toBe(false);
    }
  });
});

