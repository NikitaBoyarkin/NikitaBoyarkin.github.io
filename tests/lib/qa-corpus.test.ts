import { describe, it, expect } from "bun:test";
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QA_CORPUS, normalizeQuery, scorePair, bestMatch } from '../../src/lib/qa-corpus';

describe('QA_CORPUS', () => {
  it('has unique ids', () => {
    const ids = QA_CORPUS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has both locales for every pair', () => {
    for (const p of QA_CORPUS) {
      expect(p.ru.question.length).toBeGreaterThan(0);
      expect(p.en.question.length).toBeGreaterThan(0);
      expect(p.ru.answer.length).toBeGreaterThan(0);
      expect(p.en.answer.length).toBeGreaterThan(0);
    }
  });

  it('stores relative hrefs (no base, no leading slash)', () => {
    for (const p of QA_CORPUS) {
      for (const locale of [p.ru, p.en]) {
        for (const link of locale.links ?? []) {
          expect(link.href.startsWith('/')).toBe(false);
          expect(link.href.startsWith('http')).toBe(false);
        }
      }
    }
  });

  it('covers the core recruiter topics', () => {
    const ids = QA_CORPUS.map((p) => p.id);
    for (const id of ['who', 'role', 'experience', 'stack', 'ab-testing', 'retention', 'segmentation', 'sql', 'automation', 'volta', 'contact', 'differentiate']) {
      expect(ids).toContain(id);
    }
  });
});

describe('normalizeQuery', () => {
  it('lowercases, folds a/b → ab, strips punctuation, drops stop words', () => {
    expect(normalizeQuery('  A/B-тесты,  SQL!  ')).toBe('ab тесты sql');
    expect(normalizeQuery('что с a/b тестами?')).toBe('ab тестами');
  });

  it('keeps cyrillic and digits, drops single-character tokens', () => {
    expect(normalizeQuery('CUPED p<0.0001')).toBe('cuped 0001');
  });
});

describe('scorePair', () => {
  const pair = QA_CORPUS.find((p) => p.id === 'ab-testing')!;

  it('returns -1 when a token matches no keyword', () => {
    expect(scorePair(pair, ['zzzqqq'])).toBe(-1);
  });

  it('scores full keyword matches higher than substring', () => {
    const full = scorePair(pair, ['тест']); // exact keyword → 2
    const sub = scorePair(pair, ['тестир']); // substring of keyword → 1
    expect(full).toBeGreaterThan(sub);
  });
});

describe('bestMatch', () => {
  it('matches a RU query about A/B testing', () => {
    const m = bestMatch('что с a/b тестами?');
    expect(m?.id).toBe('ab-testing');
  });

  it('matches an EN query about SQL', () => {
    const m = bestMatch('how strong is your sql');
    expect(m?.id).toBe('sql');
  });

  it('matches contacts', () => {
    const m = bestMatch('как с тобой связаться');
    expect(m?.id).toBe('contact');
  });

  it('returns null for an empty or unmatched query', () => {
    expect(bestMatch('')).toBeNull();
    expect(bestMatch('zzzqqq')).toBeNull();
  });

  // Regression cases from the P0 review (recruiter queries that misrouted).
  it('routes the placeholder form "a/b" to A/B testing, not the first corpus pair', () => {
    expect(bestMatch('a/b')?.id).toBe('ab-testing');
    expect(bestMatch('а/б')?.id).toBe('ab-testing');
    expect(bestMatch('A/B тесты')?.id).toBe('ab-testing');
  });

  it('routes "что за игры" to games, not sql', () => {
    expect(bestMatch('что за игры')?.id).toBe('games');
  });

  it('does not false-positive on "работу" containing "бот"', () => {
    expect(bestMatch('как найти работу')).toBeNull();
  });

  it('ignores single-letter / function-word noise', () => {
    expect(bestMatch('а')).toBeNull();
    expect(bestMatch('с')).toBeNull();
    expect(bestMatch('на')).toBeNull();
  });

  it('routes a dashboard question to stack (not "who" via stop word "ты")', () => {
    expect(bestMatch('делаешь ли ты дашборды')?.id).toBe('stack');
  });

  it('matches an inflected experience query', () => {
    expect(bestMatch('сколько у тебя опыта')?.id).toBe('experience');
  });

  // P1: translit keys, question-twin keywords, and the two new pairs.
  it('routes translit keywords to their topic', () => {
    expect(bestMatch('питон')?.id).toBe('stack');
    expect(bestMatch('купед')?.id).toBe('ab-testing');
    expect(bestMatch('телеграм')?.id).toBe('contact');
  });

  it('matches the interview pair via its own question words', () => {
    expect(bestMatch('чем занимаешься сейчас')?.id).toBe('interview');
    expect(bestMatch('what are you working on now')?.id).toBe('interview');
  });

  it('routes ML / machine learning to the ml pair', () => {
    expect(bestMatch('машинное обучение')?.id).toBe('ml');
    expect(bestMatch('ml')?.id).toBe('ml');
    expect(bestMatch('нейросети')?.id).toBe('ml');
  });

  it('routes salary / schedule questions to conditions', () => {
    expect(bestMatch('зарплата')?.id).toBe('conditions');
    expect(bestMatch('когда начинаешь')?.id).toBe('conditions');
    expect(bestMatch('какой график')?.id).toBe('conditions');
  });

  it('routes "напиши мне" to contact', () => {
    expect(bestMatch('напиши мне')?.id).toBe('contact');
  });

  // 5.3: differentiation pair — «чем отличаешься» must beat the interview
  // pair's «чем» via matchedLen, and EN variants must route too.
  it('routes differentiation questions to the differentiate pair', () => {
    expect(bestMatch('чем ты отличаешься')?.id).toBe('differentiate');
    expect(bestMatch('what makes you different')?.id).toBe('differentiate');
    expect(bestMatch('сильные стороны')?.id).toBe('differentiate');
    expect(bestMatch('почему ты уникален')?.id).toBe('differentiate');
  });

  it('keeps "чем занимаешься" on the interview pair (no regression)', () => {
    expect(bestMatch('чем занимаешься сейчас')?.id).toBe('interview');
  });
});

describe('client script stays in sync with the shared matcher', () => {
  // P1: the AskMe island must reuse the lib matcher, not re-implement scoring
  // (the original drift source). Guards against reintroducing a second copy.
  const askme = readFileSync(resolve(__dirname, '../../src/components/AskMe.astro'), 'utf8');

  it('imports the shared matcher instead of re-implementing scoring', () => {
    expect(askme).toContain('from "../lib/qa-corpus"');
    expect(askme).not.toMatch(/kw\.includes\(tk\)/); // old drift-prone substring logic
    expect(askme).not.toMatch(/function score\(/);
  });
});
