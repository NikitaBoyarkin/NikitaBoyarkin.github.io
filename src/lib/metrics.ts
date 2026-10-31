// Signature results — single source of truth for the headline numbers shown
// on the homepage and the personal layer (hero metrics, career snapshot,
// ValueOffers on /about#value).
// Authoritative figures come from the CV (rendercv YAML) — except the KYC
// impact, which is the Volta case page's claim (`src/content/projects/volta.md`)
// and is bound to it by tests/lib/metrics.test.ts. Before 1.3 the numbers were
// duplicated in 4+ places and drifted (e.g. the bot automation card said
// "1–2ч" while the CV says "2ч → 5 мин"). Change a number here, not in each
// component. Language-neutral: components build their own display strings.

export const METRICS = {
  abKyc: {
    /** A/B on KYC step: conversion lift in percentage points. */
    deltaPp: 5.72,
    /**
     * 12-month incremental impact of that one KYC A/B test, EUR K, at 13,9×
     * ROI on a €15K dev-cost. It is the single experiment's modelled effect,
     * not a sum over the portfolio's layers. Source of truth is the Volta case
     * page (`src/content/projects/volta.md`, «Результат»); before 1.4 this held
     * an aggregate no page on the site ever defended.
     */
    annualEurK: 208.5,
    /**
     * Return on the €15K of development work — the same experiment, expressed as
     * a multiple. It lives here, next to the money it divides, so the hero, the
     * career snapshot and the key-figures band cannot print three different ROI
     * multiples: before 2026-11 each of them carried its own copy of `13.9`.
     */
    roiX: 13.9,
  },
  retention: {
    /** M3 retention lift, percentage points. */
    deltaPp: 9.2,
    /** Incremental LTV, EUR K. */
    ltvEurK: 227,
  },
  rfm: {
    /** Share of revenue concentrated in the 4 key segments, before/after. */
    revenueBeforePct: 12,
    revenueAfterPct: 41,
  },
  bot: {
    /** Weekly report: from manual hours to automated minutes. */
    hoursBefore: 2,
    minutesAfter: 5,
  },
  portfolio: {
    // Count of .md files in src/content/projects/. Keep this number in sync
    // with the actual project cards; update the rendercv CV when the count
    // changes rather than letting the two drift. Verified 27 via
    // `ls src/content/projects/*.md | wc -l` (2026-10-25, after the
    // `gmv-drop-rca` card landed); prd-v5's "15" is stale but out of scope
    // for this repo's source of truth.
    projects: 27,
    // Count of self-contained .sql case files in the sql-analytics-case-study
    // repo (cases/01..26_*.sql). Verified 26 against the repo on 2026-09-19;
    // must equal the "26 SQL-кейсов (25 synthetic + 1 real-data)" claim in
    // src/content/projects/sql.md. Guarded by tests/lib/metrics.test.ts.
    sqlCases: 26,
  },
} as const;
