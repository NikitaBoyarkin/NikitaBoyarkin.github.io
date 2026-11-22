# MAP — red-exporter → pure Rust

The plan and the claims. The measured state is generated: `rust-anything map --write` writes
`rust/PORT_MAP.md`; check the two against each other at each checkpoint.

- Goal: a standalone Rust binary that serves `/healthz`, `/metrics`, `POST /beacon`, keeps the
  optional SQLite sink and the background PostHog pull, and answers byte-for-byte what the Bun
  build answers (ADR-003). The Bun build stays in `src/` as reference (ADR-010).
- Root for every `rust-anything` call: `monitoring/exporter` (ADR-007).
- ADRs: ADR-001 shape · ADR-002 scope · ADR-003 equivalence bar · ADR-004 compatibility ·
  ADR-005 crates · ADR-006 recording · ADR-007 file layout · ADR-008 packaging ·
  ADR-009 checkpoints · ADR-010 keep the original. Full text: `DECISIONS.md`.
- Terms: `GLOSSARY.md`.

## State

| Step | State |
| --- | --- |
| Grill / decisions | done (ADR-001…014) |
| Research (`rust/research/`) | done — `axum-http-parity`, `rusqlite-bundled`, `reqwest-rustls-timeout`, `serde-json-parity` |
| `app record` + `app replay` on the original | done — 46/46 |
| Front door (`rust/app`) | done, every route in Rust, fallback 0% |
| Wave 0 — `config`, `metrics`, `db` | done — `config-rs` 229/229, `metrics-rs` 230/230, the sink lives in `rust/app/src/store.rs` (ADR-011) |
| Wave 1 — `beacon`, `posthog-pull` | done — `beacon-rs` 34/34, `posthog-pull-rs` 35/35 |
| Wave 2–3 — `app`, `index` | done — hand-written in `rust/app` (ADR-011) |
| Rust build vs recorded behaviours | **46/46, fallback 0%** (ADR-013 command) |
| Image | done — `Dockerfile.rust`, 29.2 MB (8.73 MB compressed) |
| Lift (`app lift`) | blocked by ADR-013 — see `HANDOFF.md` §What is left |
| Cutover | open — `rust/cutover.sh`, nothing switched |

## Units

State vocabulary: `open`, `claimed by <session> <date>`, `done`.

| Wave | Unit | Lines | State | Notes |
| --- | --- | --- | --- | --- |
| 0 | `src/config.ts` | 24 | done | pure env read; 9 fields, defaults in ADR-004 |
| 0 | `src/metrics.ts` | 113 | done | insertion order is the contract → `IndexMap`; escaping per ADR-003 |
| 0 | `src/db.ts` | 38 | done | JS-shaped API, no crate: `rust/app/src/store.rs` (ADR-011); `.dump` is a recorded effect |
| 1 | `src/beacon.ts` | 24 | done | JSON parse of one object or an array; bad shape → `bad_shape` counter |
| 1 | `src/posthog-pull.ts` | 110 | done | outbound request is a recorded effect; three response shapes + 401 |
| 2 | `src/app.ts` | 45 | done | routes, CORS, status codes, empty bodies |
| 3 | `src/index.ts` | 27 | done | wiring, poller loop, startup line `(rust)` |

## Answered questions

- `sqlite3 .dump` between Bun's SQLite and rusqlite bundled: identical, including the stored DDL —
  proven by every `POST /beacon` case's `db` effect. Bun leaves the journal mode at its default, so
  neither side sets one.
- `portfolio_posthog_pull_duration_seconds` is wall-clock: the recorded metrics bodies wildcard that
  one value (`0.[..]`) and nothing else.
- `JSON.stringify` vs `serde_json`: three silent differences (2^53 rounding, `1.0`, `-0`, `1e-6`)
  were found by a recorded case and fixed in `rust/jsnum` (ADR-012); no `known-diffs.jsonl` entry
  was needed.

## Out of scope

- Prometheus, Grafana, cloudflared, the tunnel config, the dashboards under `monitoring/grafana/`
  and `monitoring/dashboards/` — unchanged, they speak to the same exposition format.
- The site's beacon client (`src/lib/beacon.ts` in the Astro app) — unchanged.
- The bun tests (`tests/*.test.ts`) — kept, not ported (ADR-010).
