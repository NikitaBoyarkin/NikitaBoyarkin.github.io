// Renders reports/project-views-YYYY-MM-DD.html + .csv from
// public.report_project_views, read through the read-only `reports` role
// (supabase/migrations/20261108000500_reports_role.sql).
//
//   REPORTS_DB_PASSWORD=... bun run scripts/project-views-report.mjs
//
// The password is the only secret and it never reaches the HTML.

import { SQL } from "bun";
import { mkdir } from "node:fs/promises";

const REF = "geojpakugqlcwyhtnjvv";
const REGION = "eu-west-1";
const OUT_DIR = "reports";

const esc = (v) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const day = (v) => (v ? new Date(v).toISOString().slice(0, 10) : "—");

/** rows: {slug, locale, title, views, last_view}[] → {html, csv, stats}. Pure. */
export function render(rows, generated = new Date().toISOString().slice(0, 10)) {
  // One row per slug, RU and EN side by side, because the case quotes a project.
  const bySlug = new Map();
  for (const r of rows) {
    // count() comes back as a bigint, which Bun.SQL hands over as a string —
    // adding it without Number() concatenates instead of summing.
    const views = Number(r.views ?? 0);
    const entry = bySlug.get(r.slug) ?? { slug: r.slug, title: null, ru: 0, en: 0, last: null };
    if (!entry.title || r.locale === "ru") entry.title = r.title ?? entry.title;
    entry[r.locale === "en" ? "en" : "ru"] += views;
    if (r.last_view && (!entry.last || r.last_view > entry.last)) entry.last = r.last_view;
    bySlug.set(r.slug, entry);
  }

  const projects = [...bySlug.values()]
    .map((p) => ({ ...p, total: p.ru + p.en }))
    .sort((a, b) => b.total - a.total || a.slug.localeCompare(b.slug));
  const seen = projects.filter((p) => p.total > 0);
  const unseen = projects.filter((p) => p.total === 0);
  const totalViews = projects.reduce((s, p) => s + p.total, 0);
  const maxViews = Math.max(1, ...projects.map((p) => p.total));

  const bar = (n, cls) => `<span class="bar ${cls}" style="width:${((n / maxViews) * 100).toFixed(2)}%"></span>`;

  const tableRows = seen
    .map(
      (p) => `<tr>
      <td class="name">${esc(p.title ?? p.slug)}<span class="slug">${esc(p.slug)}</span></td>
      <td class="num">${p.ru}</td>
      <td class="num">${p.en}</td>
      <td class="num strong">${p.total}</td>
      <td class="date">${day(p.last)}</td>
      <td class="chart"><span class="track">${bar(p.ru, "ru")}${bar(p.en, "en")}</span></td>
    </tr>`,
    )
    .join("\n");

  const csv =
    ["slug,locale,title,views,last_view"]
      .concat(
        rows.map((r) =>
          [r.slug, r.locale, r.title, r.views ?? 0, r.last_view ? new Date(r.last_view).toISOString() : ""]
            .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
            .join(","),
        ),
      )
      .join("\n") + "\n";

  const html = `<!doctype html>
<html lang="ru">
<meta charset="utf-8">
<title>Просмотры проектов — ${generated}</title>
<style>
  @page { size: A4; margin: 14mm; }
  :root { --ink:#1b1b1f; --muted:#6b6b74; --line:#e3e3e8; --ru:#2f6feb; --en:#8b5cf6; }
  body { font: 10.5pt/1.45 -apple-system, "Segoe UI", system-ui, sans-serif; color: var(--ink); margin: 0; }
  header { border-bottom: 2px solid var(--ink); padding-bottom: 6px; margin-bottom: 14px; }
  h1 { font-size: 17pt; margin: 0 0 2px; letter-spacing: -0.01em; }
  .sub { color: var(--muted); font-size: 9pt; }
  .totals { display: flex; gap: 26px; margin: 12px 0 18px; }
  .total b { display: block; font-size: 20pt; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .total span { color: var(--muted); font-size: 8.5pt; text-transform: uppercase; letter-spacing: .06em; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: .06em;
       color: var(--muted); border-bottom: 1px solid var(--line); padding: 4px 6px; font-weight: 600; }
  td { padding: 4px 6px; border-bottom: 1px solid var(--line); vertical-align: middle; }
  tr { break-inside: avoid; }
  .name { max-width: 210px; }
  .slug { display: block; color: var(--muted); font: 7.5pt ui-monospace, monospace; }
  .num { text-align: right; font-variant-numeric: tabular-nums; width: 46px; }
  .strong { font-weight: 700; }
  .date { color: var(--muted); font-size: 8.5pt; white-space: nowrap; }
  .chart { width: 34%; }
  .track { display: flex; height: 9px; background: #f2f2f5; border-radius: 2px; overflow: hidden; }
  .bar { display: block; height: 100%; }
  .bar.ru { background: var(--ru); }
  .bar.en { background: var(--en); }
  .legend { display: flex; gap: 14px; font-size: 8.5pt; color: var(--muted); margin: 10px 0 0; }
  .chip { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
  .zero { margin-top: 20px; font-size: 9pt; color: var(--muted); }
  .zero b { color: var(--ink); }
  footer { margin-top: 18px; padding-top: 6px; border-top: 1px solid var(--line);
           font-size: 8pt; color: var(--muted); }
</style>
<header>
  <h1>Просмотры проектов</h1>
  <div class="sub">NikitaBoyarkin.github.io · источник: public.report_project_views · ${generated}</div>
</header>
<div class="totals">
  <div class="total"><b>${totalViews}</b><span>просмотров</span></div>
  <div class="total"><b>${seen.length}</b><span>проектов с трафиком</span></div>
  <div class="total"><b>${projects.length}</b><span>всего в каталоге</span></div>
</div>
<table>
  <thead><tr><th>Проект</th><th class="num">RU</th><th class="num">EN</th><th class="num">Всего</th><th class="date">Последний</th><th class="chart"></th></tr></thead>
  <tbody>
${tableRows || '<tr><td colspan="6" class="zero">Просмотров пока нет.</td></tr>'}
  </tbody>
</table>
<div class="legend"><span><i class="chip" style="background:var(--ru)"></i>RU</span><span><i class="chip" style="background:var(--en)"></i>EN</span></div>
${unseen.length ? `<p class="zero"><b>Без просмотров (${unseen.length}):</b> ${unseen.map((p) => esc(p.slug)).join(", ")}</p>` : ""}
<footer>Сгенерировано scripts/project-views-report.mjs · Ctrl+P → PDF</footer>
</html>
`;

  return { html, csv, stats: { rows: rows.length, projects: projects.length, views: totalViews } };
}

async function main() {
  const password = process.env.REPORTS_DB_PASSWORD;
  if (!password) {
    console.error("REPORTS_DB_PASSWORD is not set. Add it to .env (see supabase/migrations/20261108000500_reports_role.sql).");
    process.exit(1);
  }

  // Fields, not a URL: a password with reserved characters round-trips badly
  // through the connection-string parser (EAUTHQUERY: unsupported secret format).
  const sql = new SQL({
    hostname: `aws-1-${REGION}.pooler.supabase.com`,
    port: 5432,
    username: `reports.${REF}`,
    password,
    database: "postgres",
    max: 1,
    connection_timeout: 15,
  });

  let rows;
  try {
    rows = await sql`select slug, locale, title, views, last_view from public.report_project_views order by views desc, slug, locale`;
  } catch (error) {
    console.error(`query failed: ${error.message}`);
    process.exit(1);
  } finally {
    await sql.close();
  }

  const { html, csv, stats } = render(rows);
  const generated = new Date().toISOString().slice(0, 10);
  const base = `${OUT_DIR}/project-views-${generated}`;
  await mkdir(OUT_DIR, { recursive: true });
  await Bun.write(`${base}.html`, html);
  await Bun.write(`${base}.csv`, csv);

  console.log(`${base}.html`);
  console.log(`${base}.csv`);
  console.log(`rows: ${stats.rows} · projects: ${stats.projects} · views: ${stats.views}`);
}

if (import.meta.main) await main();
