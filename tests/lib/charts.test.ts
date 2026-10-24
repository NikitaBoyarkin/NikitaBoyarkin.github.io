import { describe, it, expect } from 'bun:test';
import { loadAllChartFiles } from '../../src/lib/charts';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const CHARTS_DIR = path.join(process.cwd(), 'src/data/charts');
const CHART_ENABLED_SLUGS = ['ab', 'cohort', 'rfm', 'sql', 'posthog', 'sales-calls', 'streamlit', 'churn', 'causal', 'volta', 'delivery'];

describe('charts payloads (src/data/charts/*.json)', () => {
  it('validates every payload against the schema — invalid files throw', () => {
    const payloads = loadAllChartFiles();
    expect(payloads.length).toBeGreaterThan(0);
  });

  it('every file belongs to a chart-enabled project', () => {
    const slugs = readdirSync(CHARTS_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''));
    for (const s of slugs) {
      expect(CHART_ENABLED_SLUGS).toContain(s);
    }
  });

  it('each payload carries at least one chart', () => {
    for (const p of loadAllChartFiles()) {
      expect(p.charts.length).toBeGreaterThan(0);
    }
  });
});