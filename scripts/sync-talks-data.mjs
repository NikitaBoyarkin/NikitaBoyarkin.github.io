#!/usr/bin/env node
// Normalises the Matemarketing 2026 programme snapshot (from the sibling
// `mm-program-page` project) into the small shape this site's talks graph
// needs: tracks/halls/days as slugs + per-talk theme tags.
//
// Read-only against the source project; writes only src/data/talks{,-en}.json.
// Usage: node scripts/sync-talks-data.mjs [path-to-program.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SRC = resolve(
  ROOT,
  '..',
  'mm-program-page',
  'src',
  'data',
  'program.json',
);

const srcPath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_SRC;

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'j', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'shh',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'ju', я: 'ja',
};

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/№/g, ' n ')
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Theme vocabulary. A talk belongs to a theme when any of its content tokens
 *  starts with one of the stems (prefix match absorbs Russian inflection). */
export const THEMES = [
  { id: 'ai', label: 'AI и агенты', labelEn: 'AI & agents', stems: ['ai', 'ии', 'агент', 'llm', 'gpt', 'нейросет', 'промпт', 'автономн'] },
  { id: 'metrics', label: 'Метрики', labelEn: 'Metrics', stems: ['метрик', 'kpi', 'показател'] },
  { id: 'ab', label: 'A/B и эксперименты', labelEn: 'A/B & experiments', stems: ['a-b', 'ab', 'эксперимент', 'aa-тест', 'aa'] },
  { id: 'bi', label: 'BI и дашборды', labelEn: 'BI & dashboards', stems: ['bi', 'дашборд', 'dashboard', 'datalens', 'metabase', 'redash', 'визуализац', 'superset'] },
  { id: 'dataeng', label: 'Данные и инженерия', labelEn: 'Data engineering', stems: ['airflow', 'dbt', 'etl', 'elt', 'пайплайн', 'хранилищ', 'clickhouse', 'sql', 'озер', 'каталог'] },
  { id: 'marketing', label: 'Маркетинг и реклама', labelEn: 'Marketing & ads', stems: ['реклам', 'маркетинг', 'кампани', 'cpa', 'romi', 'атрибуци', 'медиамикс', 'спрос'] },
  { id: 'hr', label: 'HR и команда', labelEn: 'HR & team', stems: ['найм', 'hr', 'кандидат', 'собеседован', 'онбординг', 'тимлид', 'команд', 'испытательн', 'джун'] },
  { id: 'causal', label: 'Причинный вывод', labelEn: 'Causal inference', stems: ['причинн', 'causal', 'uplift', 'инкрементальн', 'psm', 'синтетическ', 'whydra'] },
  { id: 'retention', label: 'Retention и LTV', labelEn: 'Retention & LTV', stems: ['retention', 'удержан', 'отток', 'когорт', 'ltv', 'churn'] },
  { id: 'product', label: 'Продукт и гипотезы', labelEn: 'Product & discovery', stems: ['продукт', 'гипотез', 'роадмап', 'кастдев', 'исследован', 'дискавери'] },
  { id: 'security', label: 'Безопасность и приватность', labelEn: 'Security & privacy', stems: ['безопасн', 'приватн', 'pii', 'шифрован', 'атак', 'уязвим'] },
];

const tokenize = (text) =>
  String(text ?? '')
    .toLowerCase()
    .split(/[^a-zа-яё0-9/-]+/u)
    .filter(Boolean);

/** Prefix match absorbs Russian inflection, but a two-letter Latin stem is too
 *  short for that: `bi` matched `bigtech-масштабе` and tagged a data-engineering
 *  talk as BI. Short stems must therefore be a whole token (or a token's head,
 *  as in `ab-тест`). */
const matchesStem = (token, stem) =>
  stem.length <= 2 && /^[a-z]/.test(stem)
    ? token === stem || token.startsWith(`${stem}-`)
    : token.startsWith(stem);

export function themesOf(talk) {
  const tokens = tokenize(`${talk.title} ${talk.short ?? ''} ${talk.description ?? ''}`);
  return THEMES.filter((t) => tokens.some((tok) => t.stems.some((s) => matchesStem(tok, s)))).map(
    (t) => t.id,
  );
}

function main() {
  const raw = JSON.parse(readFileSync(srcPath, 'utf-8'));

  const trackById = new Map(raw.tracks.map((t) => [t.id, t]));
  const hallSlug = new Map(raw.halls.map((h) => [h.name, slugify(h.name)]));

  const talks = raw.talks.map((t) => {
    const track = trackById.get(t.trackId) ?? null;
    return {
      id: t.id,
      title: t.title,
      hall: t.hall,
      hallSlug: hallSlug.get(t.hall) ?? slugify(t.hall),
      dayId: t.dayId,
      start: t.start,
      end: t.end,
      trackId: t.trackId ?? null,
      trackName: track?.name || t.track || '',
      trackSlug: track?.name ? slugify(track.name) : '',
      highlighted: Boolean(t.highlighted),
      lectors: (t.lectors ?? []).map((l) => ({ name: l.name, role: l.role ?? '' })),
      short: t.short ?? '',
      themes: themesOf(t),
    };
  });

  const tracks = raw.tracks
    .map((t) => ({ id: t.id, name: t.name, slug: slugify(t.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  const halls = raw.halls
    .map((h) => ({ id: h.id, name: h.name, slug: slugify(h.name), order: h.order }))
    .sort((a, b) => a.order - b.order);

  const days = raw.days
    .map((d) => ({ id: d.id, name: d.name, date: d.date, order: d.order }))
    .sort((a, b) => a.order - b.order);

  const out = {
    source: raw.source,
    generatedAt: raw.generatedAt,
    event: raw.event,
    themes: THEMES.map(({ id, label, labelEn }) => ({ id, label, labelEn })),
    tracks,
    halls,
    days,
    talks: talks.sort((a, b) => a.dayId - b.dayId || a.start.localeCompare(b.start)),
  };

  writeFileSync(join(ROOT, 'src', 'data', 'talks.json'), `${JSON.stringify(out, null, 2)}\n`);

  // EN overlay: only what the source translates — track names and talk titles.
  // Sibling of whatever snapshot was passed in, not a rewrite of its name: the
  // CLI accepts any filename, and a regex miss used to feed the RU file back in
  // as the EN overlay, silently blanking every translation.
  const enPath = join(dirname(srcPath), 'program.en.json');
  try {
    const en = JSON.parse(readFileSync(enPath, 'utf-8'));
    const overlay = {
      tracks: en.tracks ?? {},
      talkTitles: Object.fromEntries(
        Object.entries(en.talks ?? {}).map(([id, v]) => [id, v.title]),
      ),
    };
    writeFileSync(
      join(ROOT, 'src', 'data', 'talks-en.json'),
      `${JSON.stringify(overlay, null, 2)}\n`,
    );
  } catch (err) {
    // A missing overlay is expected when syncing from a trimmed snapshot; a
    // malformed or unwritable one is not, and used to print the same line.
    if (err.code === 'ENOENT') {
      console.warn(`no ${enPath} — EN overlay skipped`);
    } else {
      console.error(`EN overlay not written: ${err.message}`);
      process.exitCode = 1;
    }
  }

  const themeCounts = {};
  for (const t of out.talks) for (const th of t.themes) themeCounts[th] = (themeCounts[th] ?? 0) + 1;
  console.log(
    `talks=${out.talks.length} tracks=${tracks.length} halls=${halls.length} days=${days.length}`,
  );
  console.log(
    'themes:',
    Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}=${v}`)
      .join(' '),
  );
  console.log(`untracked=${out.talks.filter((t) => !t.trackSlug).length}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
