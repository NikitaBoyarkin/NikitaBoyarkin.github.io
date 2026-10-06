#!/usr/bin/env bun
// Flatten lhci-reports/*.json into a single CSV table for the dct board.
// Source reports are gitignored (see .gitignore: lhci-reports/), so re-run
// after every `lhci autorun`.

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORTS = join(root, "lhci-reports");
const OUT = join(root, "data", "lhci-table.csv");

// Thresholds mirror .lighthouserc.json `ci.assert.assertions`
const PERF_MIN = 0.85;
const STRICT_MIN = 0.95;

const COLUMNS = [
  "run_id",
  "fetch_time",
  "page",
  "locale",
  "performance",
  "accessibility",
  "best_practices",
  "seo",
  "lcp_ms",
  "cls",
  "tbt_ms",
  "fcp_ms",
  "speed_index_ms",
  "total_bytes",
  "contrast_score",
  "perf_pass",
  "strict_pass",
];

const METRICS = {
  lcp_ms: "largest-contentful-paint",
  tbt_ms: "total-blocking-time",
  fcp_ms: "first-contentful-paint",
  speed_index_ms: "speed-index",
  total_bytes: "total-byte-weight",
};

const num = (v) => (v === null || v === undefined || Number.isNaN(v) ? "" : v);
const esc = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** `localhost-projects_volta_-2026_09_27_20_05_54` -> `2026-09-27T20:05:54` */
function runIdFromFile(name) {
  const m = name.match(/(\d{4})_(\d{2})_(\d{2})-(\d{2})_(\d{2})_(\d{2})/);
  if (!m) return name.replace(/\.report\.json$/, "");
  const [, y, mo, d, h, mi, s] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

function rowsFromReport(file, report) {
  const url = report.finalUrl || report.requestedUrl || "";
  let path = "/";
  try {
    path = new URL(url).pathname;
  } catch {
    /* keep "/" */
  }
  const locale = path === "/en" || path.startsWith("/en/") ? "en" : "ru";
  const cats = report.categories || {};
  const audits = report.audits || {};
  const score = (k) => num(cats[k]?.score);
  const metric = (k) => {
    const v = audits[METRICS[k]]?.numericValue;
    return v === undefined || v === null ? "" : Math.round(v * 100) / 100;
  };

  const perf = cats.performance?.score;
  const a11y = cats.accessibility?.score;
  const bp = cats["best-practices"]?.score;
  const seo = cats.seo?.score;
  const contrast = audits["color-contrast"]?.score;

  return {
    run_id: runIdFromFile(file),
    fetch_time: report.fetchTime || "",
    page: path,
    locale,
    performance: num(perf),
    accessibility: num(a11y),
    best_practices: num(bp),
    seo: num(seo),
    lcp_ms: metric("lcp_ms"),
    cls: num(audits["cumulative-layout-shift"]?.numericValue),
    tbt_ms: metric("tbt_ms"),
    fcp_ms: metric("fcp_ms"),
    speed_index_ms: metric("speed_index_ms"),
    total_bytes: metric("total_bytes"),
    contrast_score: num(contrast),
    perf_pass: perf === undefined || perf === null ? "" : perf >= PERF_MIN ? 1 : 0,
    strict_pass:
      a11y == null || bp == null || seo == null
        ? ""
        : a11y >= STRICT_MIN && bp >= STRICT_MIN && seo >= STRICT_MIN && contrast === 1
          ? 1
          : 0,
  };
}

function main() {
  let files;
  try {
    files = readdirSync(REPORTS).filter((f) => f.endsWith(".json") && f !== "manifest.json");
  } catch {
    console.error(`No reports directory at ${REPORTS} — run \`lhci autorun\` first.`);
    process.exit(1);
  }

  const rows = [];
  let skipped = 0;
  for (const f of files) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(join(REPORTS, f), "utf8"));
    } catch {
      skipped++;
      continue;
    }
    // manifest.json and any future index files are arrays, not reports
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      skipped++;
      continue;
    }
    rows.push(rowsFromReport(f, parsed));
  }

  rows.sort((a, b) => (a.fetch_time < b.fetch_time ? -1 : a.fetch_time > b.fetch_time ? 1 : 0));

  const csv = [COLUMNS.join(","), ...rows.map((r) => COLUMNS.map((c) => esc(r[c])).join(","))].join("\n");
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, csv + "\n", "utf8");

  const pages = new Set(rows.map((r) => r.page));
  const runs = new Set(rows.map((r) => r.run_id));
  const fails = rows.filter((r) => r.strict_pass === 0).length;
  console.log(`wrote ${OUT}`);
  console.log(`  rows=${rows.length} runs=${runs.size} pages=${pages.size} skipped=${skipped} strict_fails=${fails}`);
}

main();
