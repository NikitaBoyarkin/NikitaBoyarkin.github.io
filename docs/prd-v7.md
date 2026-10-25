# PRD v7 — Validate Before You Polish

> **Обновление 2026-10-11:** грейд-цель устарела — **junior** (CV — источник истины). Тело не переписываю: баннер помечает расхождение.

| Field | Value |
|---|---|
| Status | Draft — ready for execution |
| Date | 2026-09-19 |
| Owner | Nikita Boyarkin |
| Supersedes | **Nothing.** `docs/prd-v6.md` stays in force. This document inserts a validation gate ahead of v6's Sprint 2 and re-orders what has not yet shipped. |
| Inherits | `docs/prd-v6.md` Goals G6.1–G6.5 and inherited Goals 13–16; the outstanding v6 tasks (S2.1–S2.4, S2.7, S3.1). |
| Source | AJTBD full audit, 2026-09-19 (vault: `Obsidian/Z-core/AJTBD - Портфолио NikitaBoyarkin Full Audit.md`) |
| Scope | Validation and sequencing only. It does not restate v6's tasks or re-open its decisions. |

---

## 0. How to read this document

This is an **execution PRD for measurement**, not a redesign document. Its job is to turn the AJTBD audit of
2026-09-19 into cheap, checkable validation work, and to stop the project from polishing a surface the audit
says is not the binding constraint.

Three rules apply:

1. **v6 stays in force.** v7 supersedes nothing. Where v6 has a task, v7 references it rather than restating it.
2. **Every task carries an acceptance criterion that fails when the task is not done.** Tasks whose decision
   depends on a minimum sample say so explicitly.
3. **Evidence classes are marked.** `[V]` verified by reading the file. `[I]` inferred from verified evidence.
   `[NV]` not verified. Never upgrade `[I]` to `[V]` in a report.

### Precondition — capture the contacts baseline first

**Task V0.1 must run before any outreach task.** The audit's risk #3 is that the North Star (contacts) does not
convert into interviews; without a staged log, neither can be measured.

---

## 1. Context

### 1.1 What the AJTBD audit found

The portfolio is **not under-built. It is built one layer below where the binding risk sits.** `[I]`

The audit ran the full-audit mode of `/ajtbd` over the portfolio as a B2B product (the buyer is the hiring
side) and produced two artefacts:

- **Top-5 B2B segments.** Ranked: (1) product teams with an experimentation culture; (2) retention/growth teams
  in subscription and fintech products; (3) seed–Series A hiring a first analyst; (4) remote-first EN employers;
  (5) data/analytics agencies. Segments 1 and 2 were selected for RAT. `[V]`
- **Top-5 risky assumptions**, scored `Score = P × I`: `[V]`

| # | Risk | P | I | Score |
|---|---|---|---|---|
| 1 | "middle+ without commercial experience" filter — a portfolio does not substitute for tenure | 4 | 5 | **20** |
| 2 | Synthetic-data portfolio reads as coursework, not proof | 4 | 4 | 16 |
| 3 | North Star (contacts) does not convert into interviews/offers | 3 | 5 | 15 |
| 4 | The `A/B & Retention` specialism is not scarce → no market pull | 3 | 4 | 12 |
| 5 | Managed distribution channels do not reach decision-makers within 90 days | 3 | 4 | 12 |

Risk #1 is the leading risk and **no task in any prior PRD addresses it.** v6 diagnosed it (P2 — "an experience
claim with nothing behind it") and chose, correctly, to make the site *honest* about it (S1.7) while deferring the
real fix (employment experience) to a 90-day goal. v7 makes the measurement of that constraint its first task. `[I]`

### 1.2 As-built: v6 Sprint 1 is executed `[V]`

Verified against the repository on 2026-09-19:

| v6 task | As-built evidence |
|---|---|
| S1.2 / G6.1 — route + nav reduction | `src/pages/*.astro` = 6 (was 7 personal routes); nav renders 5 items in `src/layouts/Base.astro:195–201` |
| S1.5 — delete dead code | `grep -rn "AudienceBar\|__reorderHomeStack\|Testimonials" src/` returns nothing |
| S1.7 / G6.2 — remove unbacked claims | `grep -rn "4+ год\|4+ year\|4 года\|4 years" src/` returns no duration claim |
| S1.10 — bot card | `grep -rn "telegram_bot_public" src/` returns nothing |
| S1.8 — untrack build output | `git ls-files dist/` = 0; `git ls-files src/graphify-out` = 0 |
| S2.5 — hero reposition | `src/pages/index.astro:83–90` renders `Продуктовый аналитик` + `A/B-тесты и retention` + the PhD line |
| S2.6 — three case studies + list | `src/pages/index.astro:132` mounts `HeadlineCases` |
| S3.2 / D14 — proof-reach instrument | `case_study_read` was replaced by `read_depth` (`src/lib/scroll-depth.ts`, `src/components/Analytics.astro:75–90`) |

**Consequence: the remaining site work is narrow.** What has not shipped is the compensating-artifact set for the
private flagships (S2.1–S2.3), its evidence marker (S2.4), the public self-dashboard (S2.7), and EN
translations (S3.1 — `posts-en` holds 2 files against 24 RU). Everything else in the "build the site" direction
is done. `[V]`

### 1.3 What this means

Three things follow, and they are the reason this PRD exists:

1. **The next marginal hour is worth more spent measuring than building.** Every art-facing fix v6 could make has
   been made. The remaining build items (S2.1–S2.3) are credibility artifacts, not new surface area — and their
   value depends on risk #2, which is unmeasured.
2. **The binding constraint is a hiring filter, not the site.** If risk #1 holds (score 20), the correct response
   is a different target role and a different artifact set — not more portfolio polish. Measuring it first is
   cheap: interviews and 20 real applications.
3. **The North Star is probably mis-set.** "Contacts/month" measures activity. The audit's risk #3 says a
   career-change profile can generate polite contacts at low conversion. A two-level metric (contacts as
   leading, finals as lagging) is the fix.

---

## 2. Problem statements

### P7.1 — The top-ranked risk has no owner `[V]`

Risk #1 scores 20 and is the only risk that, if true, invalidates the current target (middle+ product analyst).
It appears in no PRD as a task. v6 explicitly defers the true fix ("Real employment experience … 90-day goal")
and constrains itself to honesty. The measurement of *whether middle+ is reachable now* is missing entirely.

### P7.2 — The North Star cannot distinguish activity from progress `[V]`

`Goal 14` counts contact initiations. The site has no staged log: `CONTEXT.md` defines "Contact action" as
`cv_download_pdf`, `github_footer`, `linkedin_footer` — clicks, not outcomes. A contact that dies at screening
and a contact that reaches a final round are counted identically.

### P7.3 — Risk #2 is claimed but never measured `[V]`

v6's D14 adds "proof-reach rate" and S3.2 instruments it. The instrument now exists (`read_depth`), but there is
no recorded baseline and no decision rule attached to it. The audit's risk #2 (synthetic work read as
coursework) remains a hypothesis with an instrument and no reading.

### P7.4 — The positioning is asserted, not tested `[V]`

D4 sets the line `Product Analyst // A/B Testing & Retention` and S2.5 ships it. The audit's risk #4 says the
specialism may not be scarce. No test compares the specialism line against a neutral line on qualified contacts.

---

## 3. Goals and non-goals

### 3.1 Goals

| ID | Goal | Measure |
|---|---|---|
| G7.1 | Establish a staged contacts log (contact → screening → interview → final) and use it | `docs/contact-log.md` exists; ≥1 row per real contact for 30 days |
| G7.2 | Decide whether middle+ is reachable now, on evidence | 10 decision interviews + 20 applications logged; screening-invite rate computed |
| G7.3 | Record a real proof-reach baseline | `read_depth` reading in `docs/prd-v7-findings.md` |
| G7.4 | Test the specialism line against a neutral line | A/B result recorded, or explicitly marked "insufficient sample — not decided" |
| G7.5 | Re-order remaining v6 build work behind the measurement | each v6 task named as gated or ungated in §5 |

### 3.2 Non-goals — explicitly out of scope

- **Any new site surface.** v6's S2.1–S2.3 are carried over, not extended.
- **Re-opening v6 decisions** (D1–D19) or its executed Sprint 1.
- **Salary negotiation, offer strategy, interview-prep content.** Downstream of G7.2.
- **Opening private repositories.** v6 D9 stands.
- **A/B testing anything at insufficient sample.** The site's own rule (`CONTEXT.md` Traffic gate: ≥100 unique
  visits/90d) applies; below it, a task records "not decided".

---

## 4. Decisions taken (2026-09-19)

| # | Decision | Rationale |
|---|---|---|
| V1 | v7 supersedes **nothing**; it sequences around v6 | v6 Sprint 1 is executed; a supersession would strand the remaining S2.x tasks |
| V2 | North Star becomes two-level: contacts (leading) + finals (lagging) | §P7.2; the audit's risk #3 |
| V3 | **No further credibility build until risk #1 is measured** | Spending on artifacts whose value (risk #2) and target role (risk #1) are unmeasured is premature |
| V4 | Target segments for outreach: 1 (product teams with experimentation) + 2 (retention/growth), wedge = the A/B & Retention specialism | Audit Step 1 ranking; v6 D4 |
| V5 | Real applications are a first-class validation instrument, not just an outcome | 20 logged applications produce the screening-invite rate that tests risk #1 |
| V6 | Interviews are **decision interviews** — questions about screening criteria and evidence, never opinions | A JTBD/AJTBD rule: ask about past behaviour and criteria, not preferences |
| V7 | Findings land in one growing file, `docs/prd-v7-findings.md`, updated by each validation task | Avoids a sixth scattered document (v6 R8) |

---

## 5. Work plan

### Sprint 0 — Baseline (MUST RUN FIRST)

#### V0.1 — Staged contacts log

Create `docs/contact-log.md` with a fixed schema: `date | source | company | segment | stage | evidence | next action`.
`stage ∈ {contact, screening, interview, final, offer, rejected}`. Extend the site's own funnel definition in
`CONTEXT.md` to name the outcome stages (today it stops at clicks).

**Acceptance:** file exists with the schema documented; `CONTEXT.md` names the outcome stages; the log is used for
every inbound contact for 30 days. `[NV]` until rows exist.

#### V0.2 — Proof-reach baseline

Record the current `read_depth` reading (75% threshold, `/projects/*` + `/en/projects/*`) and the current
`docs/prd-v6-baseline.md` B4 value into `docs/prd-v7-findings.md`.

**Acceptance:** `docs/prd-v7-findings.md` exists and contains one `read_depth` number with the query used.

---

### Sprint 1 — Validate (the gating sprint)

#### V1.1 — Decision interviews (10)

Run 10 interviews with hiring managers / recruiters drawn from segments 1–2. Script (decision questions only):

1. Walk me through how you screen a middle+ product analyst application. What makes you stop reading?
2. In the last hire, what evidence did the person who got the offer present that the others did not?
3. When a candidate has no commercial tenure but a public portfolio, what would you need to see to advance them?
4. How do you treat work on generated/synthetic data when it is labelled as such?
5. What would make you contact a candidate before a role opens?

**Acceptance:** 10 sets of notes in `docs/prd-v7-findings.md`; ≥7 answer question 3 with a concrete bar; the
synthesised answer to "is commercial tenure a hard filter?" written as a single paragraph with the count behind it.

#### V1.2 — Application experiment (20)

Apply to 20 relevant roles (middle−/junior+ product or growth analyst, segments 1–2, RF + remote). Log each into
`docs/contact-log.md`. Compute the screening-invite rate.

**Gate:** screening-invite rate **≥20% → middle−/junior+ is reachable now**. Below 20% → treat middle+ as a
6–12 month goal and re-scope the target role. The gate result goes into `docs/prd-v7-findings.md`.

**Acceptance:** 20 applications logged with outcome; the rate computed; the gate decided in writing.

#### V1.3 — Message probes (5)

Send 5 short probes to recruiters with the positioning line and one proof link; log replies and whether they
qualify. This is a cheaper read on risk #4 than the A/B and can run in parallel.

**Acceptance:** 5 probes logged; reply rate recorded; any qualifiers moved to `docs/contact-log.md`.

#### V1.4 — Positioning A/B (risk #4)

A/B the hero headline: `Product Analyst // A/B Testing & Retention` (current) vs a neutral line
(`Product Analyst`). Primary metric: contact initiations from the hero path.

**Acceptance:** both variants measured for ≥14 days. If unique traffic is under the `CONTEXT.md` traffic gate
(≥100 unique visits/90d), record **"insufficient sample — not decided"** and do not act on the difference. A
decision made on a sub-threshold sample is a failure of this task, not a success.

---

### Sprint 2 — Prove (carried over from v6, gated on Sprint 1)

**Gate:** these run only after V1.2's gate is decided. If the target role changes, re-scope the artifact set.

#### V2.1 — v6 S2.1: `posthog-saas-analytics` → public dashboard

#### V2.2 — v6 S2.2: `streamlit-app` → 2–3 minute screen recording

#### V2.3 — v6 S2.3: `supabase-product-analytics` → public dataset + schema + RLS extract

#### V2.4 — v6 S2.4: verifiability marker on the two cards

**Acceptance (all four):** identical to v6 S2.1–S2.4. v7 adds one: each artifact is referenced from
`docs/prd-v7-findings.md` as the answer to the interview bar recorded in V1.1, or explicitly reported as not
matching it.

#### V2.5 — v6 S2.7: public PostHog dashboard for the portfolio's own funnel

**Acceptance:** identical to v6 S2.7; link also recorded in `docs/prd-v7-findings.md`.

---

### Sprint 3 — Position and distribute

#### V3.1 — v6 S3.1: translate 4–6 posts into EN

Unchanged from v6, including its PENDING on post selection.

#### V3.2 — Managed distribution (v6 Phase 12)

Run the managed channels (LinkedIn + hh.ru + GitHub profile) with UTM and PostHog attribution for 4 weeks; judge
on V0.1's staged log, not on clicks.

**Acceptance:** ≥1 visit from hh.ru; the channel with the best contact→screening rate named on day 30; every
publication carries UTM.

---

## 6. Acceptance metrics

| Metric | Baseline | Target | Window |
|---|---|---|---|
| G7.2 — screening-invite rate (20 applications) | not measured | report the number; decide the gate | Sprint 1 |
| G7.1 — contacts with a recorded stage | 0 (no log) | 100% of inbound contacts logged | 30 days |
| **Finals (new lagging metric)** | 0 | ≥1 | 120 days |
| G16 — proof-reach (`read_depth` 75%) | not recorded | recorded; then ≥40% of project-page sessions | 30 days after V0.2 |
| G7.4 — specialism vs neutral headline | not measured | decided, or "insufficient sample" | ≥14 days |
| G6.3 (v6) — flagship verifiability | 2 private | each has a reachable artifact | Sprint 2 |

**Interpretation rule:** evaluate the leading metrics (contacts, proof-reach) as counts and the lagging metric
(finals) as an absolute count. Do not derive a conversion percentage from a sample under the `CONTEXT.md` traffic
gate (≥100 unique visits/90d) and then treat it as a rate.

---

## 7. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R7.1 | Interviews confirm risk #1, wasting the sprint | That is the point — the sprint is cheap and the finding re-scopes the target role. A confirmed risk is a successful sprint. |
| R7.2 | 20 applications is a small sample | Below the 20% gate, treat as a strong signal and extend to 40 before a final decision — recorded in the findings file |
| R7.3 | A/B runs below the traffic gate and produces noise | V1.4 forbids acting on a sub-threshold result; the mandated output is "not decided" |
| R7.4 | v7 becomes a stale sixth document | V1/V7 keep it to one findings file; v6 is not superseded so nothing is stranded |
| R7.5 | Outreach leaks into "marketing the person", which reads as inauthentic | V6 restricts outreach messages to decision probes; no volume campaigns in this PRD |
| R7.6 | The real fix (employment experience) is still outside the repo | Stated as PENDING; v7 measures reachability, it does not manufacture tenure |

---

## 8. PENDING — needs the owner

| Item | Why it waits |
|---|---|
| The 10 interview targets (V1.1) | Requires naming real people in the segments |
| Permission to spend 20 applications on junior+ roles (V1.2) | A deliberate step down in level — owner's call |
| Confirmation that v6's S2.1–S2.3 stay gated behind V1.2 (V3) | If the owner prefers to build artifacts regardless, V3 is void |
| Post selection for EN translation (v6 S3.1) | Unchanged from v6 |
| Live share URLs for V2.1 / V2.5 | Account action + data-safety decision |

---

## 9. Appendix — verified facts this document relies on

Verified on 2026-09-19 in `NikitaBoyarkin.github.io`:

- Routes: `src/pages/*.astro` = 6; `src/pages/en/*.astro` = 5
- Nav: `src/layouts/Base.astro:195–201` = 5 items
- Hero: `src/pages/index.astro:83–90`
- `HeadlineCases` mount: `src/pages/index.astro:132`
- Read-depth instrument: `src/lib/scroll-depth.ts`, `src/components/Analytics.astro:75–90`
- Absences: `grep -rn "AudienceBar|__reorderHomeStack|Testimonials" src/` → none;
  `grep -rn "4+ год|4+ year|4 года|4 years" src/` → none; `grep -rn "telegram_bot_public" src/` → none
- Untracked build output: `git ls-files dist/` = 0; `git ls-files src/graphify-out` = 0
- Content counts: `posts` = 24, `posts-en` = 2
- Prior art: `docs/prd-v6.md`, `docs/prd-v6-baseline.md`, `CONTEXT.md`
- AJTBD audit: `Obsidian/Z-core/AJTBD - Портфолио NikitaBoyarkin Full Audit.md` (vault)
