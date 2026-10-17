# Explorer surface — frozen interface

**Status:** contract, frozen before code (same rule as the DSWoK Explorer's
`docs/DESIGN-CONTRACT.md`). Every agent writes only inside its own paths; anything
needed elsewhere is reported, not touched.

Ports the app-like mechanics of `00 learning/dswok-explorer` onto this portfolio:
one unified, filterable, addressable surface over every content entity, plus a
relational panel the site has never had.

---

## 1. Files and ownership

| Axis | Files (write only these) |
|---|---|
| **A. Data spine** | `src/pages/explorer-index.json.ts` |
| **B. Surface** | `src/pages/explorer.astro`, `src/pages/en/explorer.astro`, `src/components/ExplorerApp.astro`, `src/components/ExplorerFacets.astro`, `src/components/ExplorerRelations.astro` |
| **C. Graph** | `src/components/KnowledgeGraph.astro`, `src/lib/graph-url.ts` |
| **D. Visual system** | `src/styles/global.css`, `src/styles/blog.css`, `src/styles/prose.css`, `scripts/audit-palette-coverage.mjs`, `src/components/GlossaryFilter.astro` |
| **E. Shell** | `src/layouts/Base.astro`, `src/components/SearchBox.astro` |
| **Frozen (nobody edits)** | `src/lib/explorer.ts`, `tests/lib/explorer.test.ts`, this file |

## 2. Data contract

`src/lib/explorer.ts` is the single source of type truth. Read it first. The
endpoint `GET /explorer-index.json` returns `ExplorerIndex`:

```ts
{ generatedAt: string,
  records: ExplorerRecord[],           // ~250 rows, both locales
  facets:  ExplorerFacet[],            // built with buildFacets(records, 'ru')
  meta:    { recordCount, relationCount } }
```

`ExplorerRecord` (see the module for the full comment on each field):
`id · kind · locale · title · desc · href · group · groupLabel · topic · tags ·
tools · year · date · image · relations[]`.

Rules the builder must honour:

- **Ids** come from `nodeIdFor(kind, slug)` so the graph and the explorer name the
  same thing the same way. Kind → prefix: `project p`, `post post`, `term g`,
  `volta vp`, `topic topic`, `source src`.
- **Relations** are built from three real sources, never invented:
  1. the graph links (`lib/graph-data.ts#getGraphData`) for `related` /
     `children` / `topic` / `shared`, keeping only edges whose both ends are
     explorer records (drop `core:*` hubs);
  2. `lib/glossary.ts#computeBacklinks` for `backlinks`, stored **reciprocally**
     (term ↔ content that mentions it);
  3. `sources[]` on projects → a `related` edge project ↔ source, both ways.
- **Locale honesty**: RU records from the RU collections, EN records from the EN
  collections. No cross-locale fallback — the EN explorer showing 2 posts is the
  truth, not a bug to paper over.
- **`topic`** per record via `matchTopic()` with `TOPICS` from `lib/topics.ts`.
- **`year`** from `date`/`updated` when present, else `null`.
- **`href`** always through `withBase()`; **`desc`** never empty (shelf notes use
  the first ~240 chars of the body, same as `search-index.json.ts`).
- Cross-locale relation targets must **not** appear (a RU record only relates to
  RU records) — otherwise `relationsOf` silently drops them at runtime.
- **Ids are not locale-namespaced.** `nodeIdFor('project','volta')` is `p:volta`
  for both the RU and the EN record, because the graph names them the same way.
  A consumer that resolves relations must therefore index **per locale**
  (`indexById(records.filter((r) => r.locale === lang))`), never one global map —
  a global map resolves a twin to whichever locale won the Map insert and links
  the EN explorer into Russian pages.

Budget: records ≤ 400 KB. If it exceeds, trim `desc` to 200 chars, never relations.

## 3. Class contract (`xp-*`, owned by axis D, used by axis B)

The `kg-` prefix already belongs to the knowledge graph, so the explorer surface
takes `xp-`. Axis D defines these in `global.css` **using `var(--token)` only,
no raw hex**; axis B uses the names verbatim and may add component-scoped
`<style>` for layout only.

```
.xp                page shell (grid: panel + results at >=1000px)
.xp-panel          sticky facet sidebar
.xp-facets         facet stack
.xp-facet          one facet group
.xp-facet-title    group heading (uppercase micro-label)
.xp-facet-item     facet value row — button, count on the right
.xp-facet-item.is-active   accent border + accent text (never an accent fill)
.xp-toolbar        query + sort + count row above the results
.xp-count          "показано N из M · за X мс"
.xp-list           result list
.xp-item           one result row (card language: gradient-surface + hairline)
.xp-item.is-active
.xp-item-kind      kind chip
.xp-item-meta      metadata row
.xp-rel            relations block inside a row
.xp-rel-group      one relation-type group
.xp-rel-type       -type label
.xp-empty          empty state
```

Reuse, do not redefine: `.container`, `.page-title`, `.button`,
`.button-secondary`, `.icon-button`, `.search-input`, `.tag-chip`,
`.search-topic-chip`, `.badge`, `.stack`, `.visually-hidden`, `.reveal`,
`.graph-legend`.

## 4. Addressable state (axis B writes it, axis A only ships data)

`src/lib/explorer.ts` owns the codec: `readExplorerState(search, defaults)` /
`buildExplorerQuery(state)`. Canonical params, defaults omitted:

`q · lang · kind · group · topic · tag · tool · year · sort · dir` — lists are
comma-joined, multi-value within a facet is OR, facets AND each other.

The page's defaults are `{ locales: ['ru'] }` for `/explorer/` and
`{ locales: ['en'] }` for `/en/explorer/`. Writes go through
`history.replaceState` (never `pushState`, never a reload) — the same rule the
explorer app follows. The URL is the shareable artifact; there is no server.

## 5. Brand rules (non-negotiable)

- One accent (`--text-accent` / `--button-bg`), ≤15 % of the screen, **never a
  content fill**; active facet = accent border + accent text.
- No second sans family, no gradient-filled text, no `background-clip: text`.
- Hover = `translateY` + `var(--shadow-color)`, never scale/opacity alone.
- Dataviz tokens (`--text-accent-dataviz`, `--dv-*`) are information only — never
  interactive chrome.
- Every new surface must hold WCAG AA in **all three themes** (dark, light,
  cyberpunk) — `.claude/hooks/contrast-gate.js` enforces it on `global.css`.
- No-JS: the page renders a readable static shell (heading + first N results as
  real `<a>`s + empty-state copy). Islands enhance, they do not gate.
- New pages must not use `container-wide` / `container-content`
  (`tests/lib/prose-css.test.ts` scans `src/pages`).
- Russian UI copy; English code and comments.

## 6. Verification (order)

```bash
bun test tests/lib/explorer.test.ts     # the contract
bun run build                           # page count must not drop
bun run check                           # astro check: 0 errors
make check                              # full gate (build + tests + check_site.py)
bun run serve-dist & bun run scripts/mobile-audit.mjs   # mobile overflow
```

Report `file:line` evidence, not diffs or essays. Do not run git.
