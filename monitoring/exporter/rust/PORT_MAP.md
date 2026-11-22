# Port map: exporter

4 of 7 units have a Rust port; no original changed since it was recorded.

## Ports

| Unit | Crate | In Rust | Kept in the original | Cases | Last diff | Original |
| --- | --- | --- | --- | ---: | ---: | --- |
| `src/beacon.ts` | `rust/beacon-rs` | `parseBeacon`, `ingestEvent` | - | 34 | 34/34 | unchanged |
| `src/config.ts` | `rust/config-rs` | `getSettings` | - | 229 | 229/229 | unchanged |
| `src/metrics.ts` | `rust/metrics-rs` | `resetAll`, `escapeLabel`, `render` | - | 230 | 230/230 | unchanged |
| `src/posthog-pull.ts` | `rust/posthog-pull-rs` | `queryPayload`, `postToPosthog`, `parseVitals`, `updateGauges`, `pullOnce` | - | 35 | 35/35 | unchanged |

## Whole app

| Glue | Runs |
| --- | --- |
| `rust/app/src/units/beacon.rs` | Rust only |
| `rust/app/src/units/metrics.rs` | Rust only |
| `rust/app/src/units/shared.rs` | Rust only |

## Not ported yet

In the order `analyze` suggests.

| Unit | Lines | Exports | Readiness |
| --- | ---: | ---: | ---: |
| `src/app.ts` | 45 | 2 | 100 |
| `src/index.ts` | 27 | 0 | 99 |
| `src/db.ts` | 38 | 1 | 96 |

Regenerate with `rust-anything map --write`. Commit this file: when the original changes upstream, the next map marks every port whose recording it outdated.
