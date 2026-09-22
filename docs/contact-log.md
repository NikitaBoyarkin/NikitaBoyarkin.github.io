# Contact log — staged contacts (PRD v7, V0.1)

| Field | Value |
|---|---|
| Created | 2026-09-19 |
| Source PRD | `docs/prd-v7.md` §5 Sprint 0, V0.1 |
| Purpose | Turn the North Star from a click count into a staged outcome count: contact → screening → interview → final → offer / rejected |
| Owner | Nikita Boyarkin |
| Review cadence | Rolling — every inbound contact is logged within 24h; reviewed weekly |

The site's own analytics (`CONTEXT.md` → **Contact action**) records contact *initiatives*
(clicks on CV/GitHub/LinkedIn). It cannot record what happens *after* a contact: whether it
died at screening or reached a final round. This log closes that gap. A click and a final
round must never be counted as the same thing.

---

## Schema

`date | source | company | segment | stage | evidence | next action`

| Column | Meaning | Allowed values |
|---|---|---|
| `date` | Date of the event at this stage (ISO `YYYY-MM-DD`) | any date |
| `source` | Where the contact came from | `linkedin`, `hh`, `telegram`, `github`, `referral`, `direct`, `other` |
| `company` | Hiring company / employer | free text |
| `segment` | Target segment (PRD v7 §1.1 ranking) | `1` = product teams w/ experimentation, `2` = retention/growth, `3` = seed–Series A first analyst, `4` = remote-first EN, `5` = data/analytics agencies, `other` |
| `stage` | Funnel stage reached | `application`, `contact`, `screening`, `interview`, `final`, `offer`, `rejected` |
| `evidence` | Artefact proving the stage (message link, calendar invite, email ID, call notes) | free text / link |
| `next action` | The single next thing to do | free text, or `—` |

### Stage definitions

| Stage | Definition |
|---|---|
| `application` | An **outbound** application was sent to a live listing (hh response, direct company form). `evidence` = the listing URL. This is the only stage that is not inbound — it counts toward the PRD v8 outreach gate, and nothing else does. |
| `contact` | First inbound message from a recruiter / hiring manager (Telegram DM, LinkedIn InMail or connection-with-note, hh response, reply to a probe). Excludes repeats in the same thread, peer/community messages, and outbound outreach. |
| `screening` | A screening step happened or is booked — HR call, screening form, test invite. |
| `interview` | A substantive interview happened or is booked with the hiring side. |
| `final` | Reached the final round / final-stage decision. |
| `offer` | An offer was made (accepted or not — note in `evidence`). |
| `rejected` | Terminal: the process ended without advancing (rejection, silence past a stated deadline, or withdrawn). Record the last stage reached in `evidence`. |

**One row per stage transition**, not one row per contact — a single contact that goes
`contact → screening → rejected` produces three rows sharing the same `company` + `date` trail.
This is what makes the contact → screening rate computable.

---

## Log

| date | source | company | segment | stage | evidence | next action |
|---|---|---|---|---|---|---|
| — | — | — | — | — | _no rows yet — awaiting first inbound contact_ | — |

---

## How this feeds the metrics

- **North Star (leading):** count of `contact` rows per calendar month.
- **Lagging:** count of `final` and `offer` rows. Target: ≥1 by day 120 (PRD v7 §6).
- **G7.2 gate:** the screening-invite rate from the 20-application experiment (V1.2) is computed
  from this log — applications that produced a `screening` row ÷ 20.
- **Channel comparison (V3.2):** on day 30, name the `source` with the best `contact → screening`
  rate. Judge on stages, not on clicks.
- **PRD v8 outreach gate:** condition A = **20 `application` rows**; condition B = **10 `contact`
  rows escalated to a real conversation**. Thresholds in `docs/prd-v8.md` §3. Count them
  separately — an application is not a conversation.

## Rules

1. Log every inbound contact for 30 days from 2026-09-19. No cherry-picking.
2. `evidence` is required for any stage beyond `contact` — an unlinkable stage is not a stage.
3. Do not derive a conversion percentage from fewer than 20 contacts and present it as a rate
   (PRD v7 §6 interpretation rule).
4. This file is the source of truth for outcome stages; PostHog stays the source for click-level
   `Contact action` events.
