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

  it('keeps every EN link inside the EN locale', () => {
    // `/en/topics/` does not exist — Topics is a RU-only route — and the site
    // policy (`src/components/Breadcrumbs.astro`) is that an EN link never
    // leaves the locale. `games/` is a locale-neutral page served from
    // `public/games/` and is the one allowed exception.
    for (const p of QA_CORPUS) {
      for (const link of p.en.links ?? []) {
        if (link.href === 'games/') continue;
        expect(link.href.startsWith('en/'), `${p.id} EN link leaves the locale: ${link.href}`).toBe(
          true,
        );
      }
    }
  });

  it('covers the core recruiter topics', () => {
    const ids = QA_CORPUS.map((p) => p.id);
    for (const id of ['who', 'role', 'experience', 'stack', 'ab-testing', 'retention', 'segmentation', 'sql', 'automation', 'volta', 'contact', 'differentiate']) {
      expect(ids).toContain(id);
    }
  });

  // The strongest cheap invariant in this corpus: the suggestion chips render
  // `pair.question` and submit it, so a pair whose own question lands on a
  // different pair is a chip that answers the wrong thing. It caught five
  // misroutes (both Volta questions, the EN A/B chip, both games questions)
  // that every paraphrase-level assertion above had missed.
  it('routes every pair’s own question back to that pair', () => {
    for (const p of QA_CORPUS) {
      for (const locale of ['ru', 'en'] as const) {
        expect(
          bestMatch(p[locale].question)?.id,
          `${p.id} (${locale}) self-routes to another pair: "${p[locale].question}"`,
        ).toBe(p.id);
      }
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

  // A blank submit must not be a "query": the widget used to wipe the visible
  // answer and log an empty question on a stray Enter.
  it('treats whitespace and punctuation as no query', () => {
    expect(bestMatch('   ')).toBeNull();
    expect(bestMatch('\t\n')).toBeNull();
    expect(bestMatch('!!!')).toBeNull();
    expect(bestMatch('??? — …')).toBeNull();
  });

  // P2 pass: phrasings a recruiter actually types, all of which used to fall
  // through to the fallback or route to the wrong pair (measured, not guessed).
  it('routes the project / resume / hiring / English / metrics family', () => {
    expect(bestMatch('какие у тебя проекты')?.id).toBe('portfolio');
    expect(bestMatch('what are your projects')?.id).toBe('portfolio');
    expect(bestMatch('what have you built')?.id).toBe('portfolio');
    expect(bestMatch('резюме')?.id).toBe('contact');
    expect(bestMatch('cv')?.id).toBe('contact');
    expect(bestMatch('почему тебя стоит нанять')?.id).toBe('differentiate');
    expect(bestMatch('why should we hire you')?.id).toBe('differentiate');
    expect(bestMatch('уровень английского')?.id).toBe('who');
    expect(bestMatch('english level')?.id).toBe('who');
    expect(bestMatch('какие метрики')?.id).toBe('retention');
  });

  it('does not let a preposition or a short stem hijack a question', () => {
    // `про` prefix-matched `прогноз`, so "расскажи про проекты" answered ML.
    expect(bestMatch('расскажи про проекты')?.id).toBe('portfolio');
    // `граф`/`график` overlap used to send "строишь графики" to the graph.
    expect(bestMatch('строишь графики')?.id).toBe('stack');
    // `know` prefix-matched `knowledge`.
    expect(bestMatch('do you know dbt')?.id).toBe('stack');
  });

  it('sends a bare messenger mention to contact, in both locales', () => {
    expect(bestMatch('telegram')?.id).toBe('contact');
    expect(bestMatch('телеграм')?.id).toBe('contact');
  });

  it('folds ё so a yo-less spelling still matches', () => {
    expect(bestMatch('отчет')?.id).toBe('automation');
    expect(bestMatch('отчёт')?.id).toBe('automation');
    expect(bestMatch('удаленка')?.id).toBe('conditions');
  });

  it('routes start-date phrasing to conditions, not the portfolio guide', () => {
    expect(bestMatch('when can you start')?.id).toBe('conditions');
    expect(bestMatch('когда старт')?.id).toBe('conditions');
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
    // Assert on the module and the API, not on the literal import line — a
    // quote-style pass must not turn this guard red with no drift.
    expect(askme).toContain('qa-corpus');
    expect(askme).toContain('bestPair');
    expect(askme).not.toMatch(/bestScore/); // local scoring loop is back
    expect(askme).not.toMatch(/kw\.includes\(tk\)/); // old drift-prone substring logic
    expect(askme).not.toMatch(/function score\(/);
  });

  it('never ships the visitor’s typed question to analytics', () => {
    // `docs/analytics-events.md` says the payload carries no free text; the
    // typed string is the only place a visitor can put an email or a name.
    const askBlock = askme.slice(askme.indexOf('function ask('));
    expect(askBlock).not.toMatch(/question: q/);
    expect(askme).not.toContain('question.slice(0, 100)');
  });
});
