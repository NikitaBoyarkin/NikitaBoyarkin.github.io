// Build-time dashboard spine. Emits `/dashboard-index.json`: the curated cards,
// surfaces, metrics and child rows the homepage dashboard renders, for both
// locales in one document — the shape `search-index.json` already uses for RU+EN.
//
// Why an endpoint at all, when the page can call the loader directly: the numbers
// become checkable without a browser (`tests/built` reads this file's output) and
// other consumers — `llms.txt`, the GitHub profile README — can read the same
// counts instead of re-deriving them and drifting.
import { loadDashboards } from '../lib/dashboard-data';

export async function GET() {
  const dashboards = await loadDashboards();
  return new Response(JSON.stringify(dashboards), {
    headers: { 'content-type': 'application/json' },
  });
}
