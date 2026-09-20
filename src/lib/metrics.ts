// Signature results — single source of truth for the headline numbers shown
// on the homepage and value page (hero metrics, career snapshot, value page).
// Authoritative figures come from the CV (rendercv YAML); before 1.3 they were
// duplicated in 4+ places and drifted (e.g. the bot automation card said
// "1–2ч" while the CV says "2ч → 5 мин"). Change a number here, not in each
// component. Language-neutral: components build their own display strings.

export const METRICS = {
  abKyc: {
    /** A/B on KYC step: conversion lift in percentage points. */
    deltaPp: 5.72,
    /** Annualized incremental impact, EUR K. */
    annualEurK: 656,
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
    // changes rather than letting the two drift. Verified 17 via
    // `ls src/content/projects/*.md | wc -l` (2026-09-18, after PRD v6 S1.11
    // swapped the `ml` course exercise for `churn` + `causal`); prd-v5's "15"
    // is stale but out of scope for this repo's source of truth.
    projects: 17,
    // Count of self-contained .sql case files in the sql-analytics-case-study
    // repo (cases/01..26_*.sql). Verified 26 against the repo on 2026-09-19;
    // must equal the "26 SQL-кейсов (25 synthetic + 1 real-data)" claim in
    // src/content/projects/sql.md. Guarded by tests/lib/metrics.test.ts.
    sqlCases: 26,
  },
} as const;
