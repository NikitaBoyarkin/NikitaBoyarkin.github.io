# Trino demo board — local reproduction

`public/demos/trino-federation/index.html` is a generated dbt-charts export, not a
hand-authored board. It is not hand-editable: re-rendering overwrites it. This
file is the recipe for rebuilding it from scratch on the machine that holds the
two DuckDB marts.

The board proves one thing: a single SQL statement can read two DuckDB files
that belong to two independent projects, without exporting, merging or
re-loading either of them.

## What has to exist

Two DuckDB files, owned by their own projects and never copied:

| Catalog | File | Contents |
|---|---|---|
| `duckdb` | `sql-analytics-case-study/data/analytics.duckdb` | `main.events`, `main.orders`, `main.users` |
| `duckdb_promo` | `promo-margin-lab/data/marts/promo.db` | `main.promo_waves`, `main.promo_cells`, `main.breakeven` |

A local Trino coordinator (483 is what was used) on `http://127.0.0.1:8080`.

## Catalogs

Trino catalogs are static: each one is a properties file in the coordinator's
`etc/catalog/`, read at startup. `CREATE CATALOG` does not exist in 483, so a new
source is always a file plus a restart.

`etc/catalog/duckdb.properties`:

```properties
connector.name=duckdb
connection-url=jdbc:duckdb:/Users/nikitaboarkin/Desktop/00 ide/00 portfolio/sql-analytics-case-study/data/analytics.duckdb
```

`etc/catalog/duckdb_promo.properties`:

```properties
connector.name=duckdb
connection-url=jdbc:duckdb:/Users/nikitaboarkin/Desktop/00 ide/00 portfolio/promo-margin-lab/data/marts/promo.db
```

The path is absolute and may contain spaces — it is written verbatim, not
quoted or URL-encoded.

Restart after adding or editing a catalog file:

```bash
~/trino/trino-server-483/bin/launcher restart
```

Expect 80 s or so until `SHOW CATALOGS` answers again. That is normal; it is not
a hung start.

## Render the board

`charts/trino-federation.yml` declares the source and the three queries; the
board is rendered locally and the resulting HTML is what ships in `public/`.

```bash
cd "/Users/nikitaboarkin/Desktop/00 ide/00 portfolio/NikitaBoyarkin.github.io"
uvx --from dbt-charts==0.9.1 --with dbt-trino \
  dct render charts/trino-federation.yml \
  --format html \
  --output public/demos/trino-federation/index.html
```

`dbt-trino` is supplied per-invocation by `uvx --with`; do not install it into
any shared environment. The version is pinned because board output is a
committed artifact — an unpinned `dct` would silently re-render it differently.

Trino must be up before this runs; `dct render` fails per-chart otherwise.

## Why not something else

- **No `CREATE CATALOG`.** Catalogs are static in 483. There is no runtime
  registration path, so the file-plus-restart step is the design, not a
  workaround.
- **No `hive` connector.** A filesystem metastore was tried over the raw CSVs
  and refuses to start: `Could not read database schema from
  …/.raw2.trinoSchema`. It also added ~330 s to startup (410 s total versus 80 s
  without it), so it was removed rather than debugged. Federation is built on the
  two DuckDB connectors instead.
- **No Postgres arm.** Servers listen on 5432 and 5433, but their credentials are
  unknown. A third catalog would need `connection-url`, `connection-user` and
  `connection-password`; none were guessed.

## Styling

The board carries its own palette because it is a compiler export — it does not
load `/demos/demo.css` or `/demos/demo-theme.js` and does not follow the site's
three themes. It is deliberately absent from the `PAGES` list in
`tests/lib/demo-tokens.test.ts` for the same reason as `volta-board`; see
`DESIGN.md` → Demos.
