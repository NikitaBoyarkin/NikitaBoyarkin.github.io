// Curated Q&A corpus for the "Ask me" widget. Pure data — no Astro imports,
// no `withBase` (hrefs are relative; the component applies the base path).
// Unit-testable in isolation (see tests/lib/qa-corpus.test.ts).
//
// Each pair answers a question a recruiter or visitor might ask. `keywords`
// are match tokens in both languages (lowercase, no punctuation). The
// component scores a typed query against `keywords` and renders the best
// match's answer plus its links.

export interface QALink {
  label: string;
  /** Relative path (no base) — the component wraps it with `withBase`. */
  href: string;
}

export interface QALocale {
  question: string;
  answer: string;
  links?: QALink[];
}

export interface QAPair {
  id: string;
  keywords: string[];
  ru: QALocale;
  en: QALocale;
}

export const QA_CORPUS: QAPair[] = [
  {
    id: "who",
    keywords: ["кто", "ты", "who", "about", "никита", "boyarkin", "nikita", "имя", "name", "представься"],
    ru: {
      question: "Кто ты?",
      answer:
        "Я Никита Бояркин — Data Analyst / Product Analyst. Портфолио воспроизводимых аналитических проектов — эксперименты, retention, сегментация — с полной методологией и кодом. Создано из проектной работы, а не из найма. Специализация — SQL, Python и воспроизводимая статистическая методология (CUPED, AA-тесты, ship-gates).",
      links: [{ label: "Обо мне", href: "about/" }],
    },
    en: {
      question: "Who are you?",
      answer:
        "I'm Nikita Boyarkin — a Data Analyst / Product Analyst. Portfolio of reproducible analytics projects — experimentation, retention, segmentation — with full methodology and code. Built from project work, not from employment. Specialized in SQL, Python and reproducible statistical methodology (CUPED, AA-tests, ship-gates).",
      links: [{ label: "About me", href: "en/about/" }],
    },
  },
  {
    id: "role",
    keywords: ["роль", "role", "вакансия", "job", "позиция", "position", "целишься", "target", "ищу", "looking"],
    ru: {
      question: "На какую роль целишься?",
      answer:
        "Открыт к Data Analyst / Product Analyst ролям (middle). Сейчас активно готовлюсь к интервью в BI / DA / Product Analytics: SQL, pandas, алгоритмы и мок-собеседования.",
      links: [{ label: "Контакты", href: "contact/" }],
    },
    en: {
      question: "What role are you looking for?",
      answer:
        "Open to Data Analyst / Product Analyst roles (middle). Currently preparing for BI / DA / Product Analytics interviews: SQL, pandas, algorithms and mock interviews.",
      links: [{ label: "Contact", href: "en/contact/" }],
    },
  },
  {
    id: "experience",
    keywords: ["опыт", "experience", "лет", "years", "стаж", "сколько"],
    ru: {
      question: "Сколько у тебя опыта?",
      answer:
        "Портфолио воспроизводимых аналитических проектов — эксперименты, retention, сегментация — с полной методологией и кодом. Создано из проектной работы, а не из найма. Данные в портфолио синтетические, но методология боевая: каждый кейс воспроизводим и откалиброван симуляцией.",
    },
    en: {
      question: "How much experience do you have?",
      answer:
        "Portfolio of reproducible analytics projects — experimentation, retention, segmentation — with full methodology and code. Built from project work, not from employment. The portfolio data is synthetic, but the methodology is production-grade: every case is reproducible and calibrated by simulation.",
    },
  },
  {
    id: "stack",
    // "sql"/"duckdb" intentionally NOT here — they route to the SQL case study.
    keywords: ["стек", "stack", "технологии", "tech", "tools", "инструменты", "python", "питон", "tableau", "pandas", "навыки", "skills", "дашборд", "дашборды", "dashboard", "dashboards", "визуализ", "visualiz", "chart", "charts", "диаграмм", "excel"],
    ru: {
      question: "Какой у тебя стек?",
      answer:
        "SQL (DuckDB), Python (pandas, NumPy, SciPy, scikit-learn), A/B-тестирование, retention-анализ, сегментация (RFM), Tableau, автоматизация (Telegram-боты, cron). Визуализация — Matplotlib / Seaborn / Streamlit.",
      links: [{ label: "Темы", href: "topics/" }],
    },
    en: {
      question: "What's your stack?",
      answer:
        "SQL (DuckDB), Python (pandas, NumPy, SciPy, scikit-learn), A/B testing, retention analysis, segmentation (RFM), Tableau, automation (Telegram bots, cron). Visualization — Matplotlib / Seaborn / Streamlit.",
      links: [{ label: "Topics", href: "en/topics/" }],
    },
  },
  {
    id: "ab-testing",
    keywords: ["ab", "a/b", "тест", "тестирование", "experiment", "cuped", "купед", "aa", "bonferroni", "ship", "gate", "p-value", "эксперимент"],
    ru: {
      question: "Что у тебя с A/B-тестами?",
      answer:
        "Полный toolkit: CUPED (сжатие SE), AA-тесты на Type I error, коррекция множественных сравнений (Bonferroni/BH), alpha-spending и always-valid p-values (mSPRT), delta-method для ratio-метрик. В кейсе Volta — ship-gate из 3 условий и +5.72pp KYC-конверсии (p<0.0001).",
      links: [
        { label: "A/B Toolkit", href: "projects/ab/" },
        { label: "Volta", href: "projects/volta/" },
      ],
    },
    en: {
      question: "What about A/B testing?",
      answer:
        "A full toolkit: CUPED (SE reduction), AA-tests on Type I error, multiple-comparison correction (Bonferroni/BH), alpha-spending and always-valid p-values (mSPRT), delta-method for ratio metrics. In the Volta case — a 3-condition ship-gate and +5.72pp KYC conversion (p<0.0001).",
      links: [
        { label: "A/B Toolkit", href: "en/projects/ab/" },
        { label: "Volta", href: "en/projects/volta/" },
      ],
    },
  },
  {
    id: "retention",
    keywords: ["retention", "когорт", "cohort", "удержание", "ltv", "arpu", "отток", "churn"],
    ru: {
      question: "Расскажи про retention-анализ.",
      answer:
        "Когортная матрица с треугольным затуханием, ARPU/LTV по когортам с честным caveat по возрасту наблюдения, кривые оттока. В Volta — +9.2pp M3-retention и +€227K/yr инкрементального LTV.",
      links: [{ label: "Cohort Dashboard", href: "projects/cohort/" }],
    },
    en: {
      question: "Tell me about retention analysis.",
      answer:
        "Cohort retention matrix with triangular decay, ARPU/LTV by cohort with an honest observation-age caveat, churn curves. In Volta — +9.2pp M3 retention and +€227K/yr incremental LTV.",
      links: [{ label: "Cohort Dashboard", href: "en/projects/cohort/" }],
    },
  },
  {
    id: "segmentation",
    keywords: ["сегмент", "segmentation", "rfm", "клиент", "сегментация"],
    ru: {
      question: "Что с сегментацией клиентов?",
      answer:
        "RFM-анализ банковских клиентов: Recency / Frequency / Monetary, 4 сегмента с per-segment стратегией монетизации. В Volta — миграция сегментов до +€310K/yr; в RFM-кейсе — 12% → 41% выручки от целевых сегментов.",
      links: [{ label: "RFM", href: "projects/rfm/" }],
    },
    en: {
      question: "What about customer segmentation?",
      answer:
        "RFM analysis of bank clients: Recency / Frequency / Monetary, 4 segments with a per-segment monetization strategy. In Volta — segment migration up to +€310K/yr; in the RFM case — 12% → 41% of revenue from target segments.",
      links: [{ label: "RFM", href: "en/projects/rfm/" }],
    },
  },
  {
    id: "sql",
    keywords: ["sql", "duckdb", "запрос", "query", "база", "database", "кейс", "case"],
    ru: {
      question: "Насколько силён твой SQL?",
      answer:
        "10 end-to-end SQL-кейсов на синтетическом датасете (~183k событий, 20k signups), запускаются на DuckDB одной командой: funnel, N-day retention, stickiness, gaps-and-islands, A/B-конверсия, revenue attribution. Regression-тесты защищают каждый кейс.",
      links: [{ label: "SQL Case Study", href: "projects/sql/" }],
    },
    en: {
      question: "How strong is your SQL?",
      answer:
        "10 end-to-end SQL cases on a synthetic dataset (~183k events, 20k signups), runnable on DuckDB with one command: funnel, N-day retention, stickiness, gaps-and-islands, A/B conversion, revenue attribution. Regression tests guard every case.",
      links: [{ label: "SQL Case Study", href: "en/projects/sql/" }],
    },
  },
  {
    id: "automation",
    keywords: ["бот", "bot", "telegram", "автоматизац", "automation", "отчёт", "report", "cron", "пайплайн", "pipeline"],
    ru: {
      question: "Что с автоматизацией отчётности?",
      answer:
        "Telegram-бот, который собирает еженедельный отчёт: cron-планировщик, SQL-запросы к витрине, KPI-таблица со sparklines, дельта к прошлой неделе. Ручная сборка 1–2ч → 0, с fallback-уведомлениями при сбоях источников.",
      links: [{ label: "Telegram Bot", href: "projects/bot/" }],
    },
    en: {
      question: "What about reporting automation?",
      answer:
        "A Telegram bot that assembles the weekly report: cron scheduler, SQL queries to the mart, KPI table with sparklines, delta vs last week. Manual assembly 1–2h → 0, with fallback notifications on source failures.",
      links: [{ label: "Telegram Bot", href: "en/projects/bot/" }],
    },
  },
  {
    id: "volta",
    keywords: ["volta", "необанк", "neobank", "главный", "featured", "kyc", "флагман"],
    ru: {
      question: "Что за проект Volta?",
      answer:
        "End-to-end аналитика необанка на синтетических fintech-данных: 22 проекта — funnel, A/B-тест, retention и сегментация одной петлёй, слой Market & Jobs и валидация RAT v2. Ключевой результат — +5.72pp KYC-конверсии (Z=5.82, p<0.0001), €656K/yr (44× ROI), с CUPED, AA-тестом и Bonferroni.",
      links: [{ label: "Volta", href: "projects/volta/" }],
    },
    en: {
      question: "What is the Volta project?",
      answer:
        "End-to-end neobank analytics on synthetic fintech data: 22 projects — funnel, A/B test, retention and segmentation in one loop, plus a Market & Jobs layer and RAT v2 validation. Key result — +5.72pp KYC conversion (Z=5.82, p<0.0001), €656K/yr (44× ROI), with CUPED, AA-test and Bonferroni.",
      links: [{ label: "Volta", href: "en/projects/volta/" }],
    },
  },
  {
    id: "contact",
    keywords: ["контакт", "contact", "связаться", "telegram", "телеграм", "github", "linkedin", "почта", "email", "написать", "напиши", "reach", "связь", "телеф"],
    ru: {
      question: "Как с тобой связаться?",
      answer:
        "Быстрее всего — Telegram @lofinibo. Также GitHub, LinkedIn и страница контактов. CV — одной кнопкой, скачивается в PDF.",
      links: [
        { label: "Контакты", href: "contact/" },
        { label: "CV", href: "CV-Nikita-Boyarkin.pdf" },
      ],
    },
    en: {
      question: "How can I reach you?",
      answer:
        "Fastest — Telegram @lofinibo. Also GitHub, LinkedIn and the contact page. The CV is a single button that downloads a PDF.",
      links: [
        { label: "Contact", href: "en/contact/" },
        { label: "CV", href: "CV-Nikita-Boyarkin.pdf" },
      ],
    },
  },
  {
    id: "portfolio",
    keywords: ["портфолио", "portfolio", "навигац", "navigate", "start", "начать", "структура", "устроено", "как читать"],
    ru: {
      question: "Как устроено портфолио?",
      answer:
        "Начни со страницы «Обо мне» — там jump-nav с маршрутом по портфолио. Проекты сгруппированы по трекам (эксперименты / аналитика / продукт / инженерия), есть статьи, граф знаний и аркада мини-игр. Поиск открывается клавишей «/».",
      links: [
        { label: "Обо мне", href: "about/" },
        { label: "Проекты", href: "projects/" },
      ],
    },
    en: {
      question: "How is the portfolio organized?",
      answer:
        "Start with the «About» page — it has a jump nav with a route through the portfolio. Projects are grouped by track (experiments / analytics / product / engineering), plus writing, a knowledge graph and a mini-game arcade. Search opens with «/».",
      links: [
        { label: "About", href: "en/about/" },
        { label: "Projects", href: "en/projects/" },
      ],
    },
  },
  {
    id: "interview",
    keywords: ["интервью", "interview", "подготовка", "prep", "middle", "bi", "собеседование", "чем", "занимаешься", "занят", "сейчас", "currently", "doing", "working", "now"],
    ru: {
      question: "Чем занимаешься сейчас?",
      answer:
        "Готовлюсь к BI / Data Analyst и Product Analyst middle-интервью: SQL, pandas, алгоритмы, мок-собеседования. Параллельно развиваю Obsidian knowledge base по product-аналитике и экспериментирую с AI-assisted аналитикой на Claude Code + MCP.",
    },
    en: {
      question: "What are you working on now?",
      answer:
        "Preparing for BI / Data Analyst and Product Analyst middle interviews: SQL, pandas, algorithms, mock interviews. In parallel, maintaining an Obsidian knowledge base on product analytics and experimenting with AI-assisted analytics on Claude Code + MCP.",
    },
  },
  {
    id: "ai",
    keywords: ["ai", "claude", "mcp", "llm", "искусственный", "интеллект", "автоматизац", "агент", "agent"],
    ru: {
      question: "Используешь AI в работе?",
      answer:
        "Да — экспериментирую с AI-assisted аналитическими workflow на Claude Code + MCP: автоматизация vault-операций, генерация кода, оркестрация агентов. Считаю, что аналитик будущего — это человек + агенты.",
    },
    en: {
      question: "Do you use AI in your work?",
      answer:
        "Yes — experimenting with AI-assisted analytics workflows on Claude Code + MCP: vault automation, code generation, agent orchestration. I believe the analyst of the future is a human + agents.",
    },
  },
  {
    id: "ml",
    keywords: ["ml", "машин", "machine", "learning", "обучение", "scikit", "модел", "нейро", "deep", "прогноз", "классификац"],
    ru: {
      question: "Есть ли ML в твоей работе?",
      answer:
        "Да, прикладной ML и causal inference: в портфолио — модель оттока без утечек (as-of признаки, хронологический сплит train/val/test, recall@top-10% 0.53, lift 3.07×) и CUPED/uplift для экспериментов (стандартная ошибка −26% при том же ATE). Я не позиционируюсь как ML-инженер: сильная сторона — SQL, статистика и продуктовая аналитика, а ML-инструменты подключаю там, где они решают задачу.",
      links: [
        { label: "Churn-модель", href: "projects/churn/" },
        { label: "Causal / Uplift", href: "projects/causal/" },
      ],
    },
    en: {
      question: "Do you do ML?",
      answer:
        "Yes — applied ML and causal inference: the portfolio has a leakage-free churn model (as-of features, chronological train/val/test split, recall@top-10% 0.53, lift 3.07x) and CUPED/uplift for experiments (standard error −26% at the same ATE). I don't position myself as an ML engineer — my strength is SQL, statistics and product analytics, and I bring ML tools in where they solve the problem.",
      links: [
        { label: "Churn model", href: "en/projects/churn/" },
        { label: "Causal / Uplift", href: "en/projects/causal/" },
      ],
    },
  },
  {
    id: "games",
    keywords: ["игра", "игр", "game", "аркада", "arcade", "snake", "pong", "2048", "развлечение", "fun"],
    ru: {
      question: "Что за игры на сайте?",
      answer:
        "Мини-игры в браузере — и про аналитику тоже: A/B Test (догони p < 0.05), Funnel Drop (лови пользователей в воронке), плюс классические Snake / 2048 / Pong. Работают на телефоне.",
      links: [{ label: "Аркада", href: "games/" }],
    },
    en: {
      question: "What are the games on the site?",
      answer:
        "Browser mini-games — including analytics ones: A/B Test (chase p < 0.05), Funnel Drop (catch users through the funnel), plus classic Snake / 2048 / Pong. They work on mobile too.",
      links: [{ label: "Arcade", href: "games/" }],
    },
  },
  {
    id: "graph",
    keywords: ["граф", "graph", "знания", "knowledge", "карта", "домен", "domain"],
    ru: {
      question: "Что такое граф знаний?",
      answer:
        "Интерактивная карта домена product-аналитики: темы, проекты и статьи как узлы графа. Показывает, как связаны SQL, A/B-тесты, retention и сегментация — и где в этой карте я.",
      links: [{ label: "Граф", href: "graph/" }],
    },
    en: {
      question: "What is the knowledge graph?",
      answer:
        "An interactive map of the product-analytics domain: topics, projects and posts as graph nodes. It shows how SQL, A/B testing, retention and segmentation connect — and where I sit in that map.",
      links: [{ label: "Graph", href: "en/graph/" }],
    },
  },
  {
    id: "cv",
    keywords: ["резюме", "cv", "resume", "pdf", "скачать"],
    ru: {
      question: "Где резюме?",
      answer:
        "CV скачивается одной кнопкой «CV» на всех страницах — файл в формате PDF. Синхронизирован с источником истины в rendercv.",
      links: [{ label: "CV", href: "CV-Nikita-Boyarkin.pdf" }],
    },
    en: {
      question: "Where is the CV?",
      answer:
        "The CV downloads from the «CV» button on every page — a PDF file. Kept in sync with the rendercv source of truth.",
      links: [{ label: "CV", href: "CV-Nikita-Boyarkin.pdf" }],
    },
  },
  {
    id: "conditions",
    keywords: ["зарплат", "salary", "услов", "conditions", "график", "режим", "день", "when", "начинаешь", "срок", "remote", "удалён", "office", "офис", "часы", "pay", "компенсац", "вилк", "бюджет", "договор", "заработ"],
    ru: {
      question: "Условия: зарплата, график, старт?",
      answer:
        "Условия обсуждаю индивидуально на интервью — публично не озвучиваю. Открыт к data / product analyst middle-ролям; формат (офис/гибрид/удалёнка) и сроки выхода — по договорённости.",
    },
    en: {
      question: "Salary, schedule, start date?",
      answer:
        "I discuss terms individually at the interview stage — I don't publish them. Open to data / product analyst middle roles; format (office/hybrid/remote) and start date are negotiable.",
    },
  },
  {
    id: "differentiate",
    // «чем» deliberately NOT here — it routes to the interview pair; the
    // longer «отличаешься»/«different» tokens win the tie via matchedLen.
    keywords: ["отличаешься", "отличие", "отличает", "уникальн", "уникален", "выделяешься", "выделяешь", "преимуществ", "сильные", "стороны", "плюсы", "конкурентн", "different", "unique", "strengths", "advantage", "competitive", "distinguish", "standout", "stand"],
    ru: {
      question: "Чем ты отличаешься от других кандидатов?",
      answer:
        "Три вещи. (1) Методология, а не дашборды: каждый кейс воспроизводим — CUPED, AA-тесты, ship-gates, калибровка симуляцией. (2) Полный цикл в одном проекте: Volta — funnel → A/B → retention → сегментация одной петлёй. (3) Сайт сам — кейс product analytics: PostHog, события, дашборд под рекрутера. Плюс экспериментирую с AI-assisted аналитикой (Claude Code + MCP).",
      links: [
        { label: "Volta", href: "projects/volta/" },
        { label: "Граф знаний", href: "graph/" },
      ],
    },
    en: {
      question: "What makes you different from other candidates?",
      answer:
        "Three things. (1) Methodology, not dashboards: every case is reproducible — CUPED, AA-tests, ship-gates, simulation calibration. (2) A full loop in one project: Volta — funnel → A/B → retention → segmentation in a single pass. (3) The site itself is a product-analytics case: PostHog, events, a recruiter-facing dashboard. Plus I experiment with AI-assisted analytics (Claude Code + MCP).",
      links: [
        { label: "Volta", href: "en/projects/volta/" },
        { label: "Knowledge graph", href: "en/graph/" },
      ],
    },
  },
];

// RU/EN function words that carry no topical signal. Deliberately small: a
// keyword must never be dropped («сколько» stays — it's an experience keyword).
const STOPWORDS = new Set([
  // RU
  "а", "о", "у", "ты", "вы", "он", "она", "мы", "мне", "меня", "тебя", "тобой",
  "что", "как", "за", "на", "по", "из", "в", "с", "для", "ли", "об", "же",
  "бы", "то", "это", "так", "все", "всё", "или", "где", "когда", "свой", "свои",
  // EN
  "a", "an", "the", "is", "are", "do", "does", "you", "your", "my", "me",
  "what", "with", "how", "and", "or", "of", "to", "in", "on", "at",
]);

/**
 * Normalize a query into match tokens: lowercase, fold `a/b`/`а/б` → `ab`
 * (the placeholder's example form), strip punctuation, drop stop words and
 * single-character tokens (they substring-match everything and add noise).
 * This is the shared tokenizer used by both the server-side corpus API and
 * the client-side widget script.
 */
export function normalizeTokens(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/a\/b|а\/б/gi, "ab")
    .replace(/[^a-zа-яё0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

export interface TokenMatch {
  score: number;
  /** Number of exact full-keyword hits — the primary tie-breaker. */
  exact: number;
  /** Total length of matched tokens — secondary tie-breaker. */
  matchedLen: number;
}

/**
 * Score a pair's keywords against pre-normalized tokens. An exact keyword hit
 * scores 2; a prefix overlap scores 1, but only when the token is ≥ 3 chars
 * (a 2-char keyword must match exactly — this kills the `бот` inside
 * `работу` false positive and single-letter noise). Returns -1 when nothing
 * matched. Prefix rules: `kw.startsWith(tk)` covers user typing a stem
 * (`тест` → `тестирование`); `tk.startsWith(kw)` covers inflections of a
 * keyword (`тесты` ← `тест`).
 */
export function matchPair(keywords: string[], tokens: string[]): TokenMatch {
  let score = 0;
  let exact = 0;
  let matchedLen = 0;
  for (const tk of tokens) {
    let best = 0;
    for (const kw of keywords) {
      let s = 0;
      if (kw === tk) {
        s = 2;
      } else if (tk.length >= 3 && kw.startsWith(tk)) {
        s = 1;
      } else if (kw.length >= 3 && tk.startsWith(kw)) {
        s = 1;
      }
      if (s > best) best = s;
    }
    if (best > 0) {
      score += best;
      if (best === 2) exact++;
      matchedLen += tk.length;
    }
  }
  return { score: score === 0 ? -1 : score, exact, matchedLen };
}

/** Normalize a query for matching: lowercase, strip punctuation, collapse spaces. */
export function normalizeQuery(q: string): string {
  return normalizeTokens(q).join(" ");
}

/**
 * Score a pair against query tokens. Returns -1 if NO token matches any
 * keyword; otherwise the sum of per-token overlap scores (2 for a full
 * keyword match, 1 for a prefix/stem match).
 */
export function scorePair(pair: QAPair, tokens: string[]): number {
  return matchPair(pair.keywords, tokens).score;
}

/**
 * Best matching pair for a query, or null if nothing scores ≥ 1. Ties are
 * broken by exact-hit count, then by total matched-token length, then by
 * corpus order — so short/noisy queries no longer drift to the first pair.
 */
export function bestMatch(q: string): QAPair | null {
  const tokens = normalizeTokens(q);
  if (!tokens.length) return null;
  let best: QAPair | null = null;
  let bestScore = 0;
  let bestExact = 0;
  let bestLen = 0;
  for (const pair of QA_CORPUS) {
    const m = matchPair(pair.keywords, tokens);
    if (m.score < 1) continue;
    const better =
      m.score > bestScore ||
      (m.score === bestScore && m.exact > bestExact) ||
      (m.score === bestScore && m.exact === bestExact && m.matchedLen > bestLen);
    if (better) {
      best = pair;
      bestScore = m.score;
      bestExact = m.exact;
      bestLen = m.matchedLen;
    }
  }
  return bestScore >= 1 ? best : null;
}
