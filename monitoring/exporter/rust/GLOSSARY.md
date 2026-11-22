# GLOSSARY — the original's terms and their names in Rust

Every unit names the same thing the same way. Grows as units bring new terms.

| Original (TS) | Meaning | Rust name (planned) |
| --- | --- | --- |
| `Settings` | the nine env-derived settings of one process | `settings::Settings` (struct), `settings::get_settings(env)` |
| `MetricType` | `"counter"` \| `"gauge"` | `metrics::MetricType` (enum) |
| `Family` | a metric definition: name, help, type, label names | `metrics::Family` |
| `Metric` | one family plus its samples, keyed by label values | `metrics::Metric` (holds `IndexMap<LabelKey, Sample>`) |
| `Sample` | label values + current value | `metrics::Sample` |
| `LabelValues` | `Record<string, string>` of label name → value | `metrics::LabelValues` = `IndexMap<String, String>` |
| `label key` | `labelNames.map(n => n=value).join("\u0000")` | `metrics::LabelKey` (`String`, NUL-joined) |
| `inc` / `set` / `get` / `clear` / `snapshot` | sample mutations and reads | same names on `Metric` |
| `render()` | the whole exposition text | `metrics::render()` |
| `escapeLabel` | `\\`, `\"`, `\n` escaping | `metrics::escape_label` |
| `FAMILIES` | the ordered list of every metric family | `metrics::FAMILIES` (a `[&Family; 13]` table) |
| `resetAll` | clear every family | `metrics::reset_all()` |
| `parseBeacon` | JSON body → array of events | `beacon::parse_beacon(body) -> Result<Vec<Event>>` |
| `ingestEvent` | one event → counters/gauges | `beacon::ingest_event(event)` |
| `BeaconStore` | append-only sink behind `BEACON_DB` | `db::BeaconStore` (`open`, `append`, `close`) |
| `queryPayload` | the HogQL request body | `posthog::query_payload(window)` |
| `postToPosthog` | one authenticated POST | `posthog::post_to_posthog(&settings)` |
| `parseVitals` | response → path → `{lcp,inp,cls,fcp}` | `posthog::parse_vitals(resp)` |
| `updateGauges` | vitals → four gauges | `posthog::update_gauges(vitals)` |
| `pullOnce` | one pull, including error accounting and duration | `posthog::pull_once(&settings)` |
| `createHandler` | request → response, for every route | `app::handle(state, request)` |
| `createServer` | bind and serve | `app::serve(state)` (axum) |
| `startPoller` | background loop every `posthogPullInterval` s | `app::start_poller(state)` |
| `beaconFailures{reason}` | counter of ingestion failures: `parse`, `bad_shape` | same metric, labels `reason` |
| `exporterUp` | gauge set to 1 when the poller starts | same metric, no labels |
| RED | Rate / Errors / Duration — the dashboard's frame | not code; product term only |
