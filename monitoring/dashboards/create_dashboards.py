#!/usr/bin/env python3
"""Provision PostHog dashboards for the Astro portfolio site.

Creates four dashboards (insight tiles built with the `query` node format):
  a) «Контент и вовлечение»  — content and engagement events
  b) «RU vs EN»              — locale split
  c) «Контакт-конверсия 30д» — contact conversion funnel + CTA trends
  d) «Games»                 — games hub events (public/games)

Design notes:
- Insights are created via POST /api/projects/{id}/insights/ with a `query`
  node (TrendsQuery / FunnelsQuery / EventsQuery). The legacy top-level
  `filters` field is intentionally NOT used: the API blocks it.
- Stdlib only (urllib.request), no third-party dependencies.
- POSTHOG_API_KEY is read from the environment and never printed or logged.
- DRY RUN is the default: payloads are printed, ZERO network calls are made.
  Pass --apply to actually create objects.
- Idempotent on --apply: existing dashboards with the same name are skipped.

Existing dashboards (1994322 «Рекрутер», 2024833 «Портфолио — аналитика»,
1660826 «My App Dashboard») are never touched: the script only creates and
appends; it never modifies or deletes anything it did not create in this run.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

API_KEY_ENV = "POSTHOG_API_KEY"
DEFAULT_PROJECT_ID = "451732"
DEFAULT_HOST = "https://us.posthog.com"

# ---------------------------------------------------------------------------
# Query-node builders (PostHog query API, not the legacy `filters` format)
# ---------------------------------------------------------------------------


def date_range(days: int = 30) -> dict:
    """Relative date range for query nodes ("-30d" from today)."""
    return {"date_from": f"-{days}d", "date_to": None, "explicitDate": True}


def prop(key: str, value, operator: str = "exact", prop_type: str = "event") -> dict:
    """Property filter attached to an EventsNode."""
    return {"type": prop_type, "key": key, "value": value, "operator": operator}


def events_node(event: str, math: str | None = None, properties: list | None = None) -> dict:
    """EventsNode used inside the `series` array of TrendsQuery/FunnelsQuery.

    `math` is omitted for funnel steps; for trends it is "total" or
    "dau" (unique users).
    """
    node = {"kind": "EventsNode", "event": event}
    if math:
        node["math"] = math
    if properties:
        node["properties"] = properties
    return node


def trends_query(series: list, breakdown: list | None = None) -> dict:
    """TrendsQuery over one or more event series, daily, last 30 days."""
    query: dict = {
        "kind": "TrendsQuery",
        "series": series,
        "interval": "day",
        "dateRange": date_range(),
    }
    if breakdown:
        # Event-level breakdown (properties sent with the event, e.g. the
        # `locale` super property or `utm_source` on $pageview). The API
        # rejects `breakdown` on the query node — it lives inside
        # `breakdownFilter` (verified against us.posthog.com 2026-09-28).
        query["breakdownFilter"] = {
            "breakdown": breakdown,
            "breakdown_type": "event",
        }
    return query


def funnels_query(series: list) -> dict:
    """FunnelsQuery with one EventsNode per step (unique users by default)."""
    return {
        "kind": "FunnelsQuery",
        "series": series,
        "dateRange": date_range(),
    }


def events_query(event: str, limit: int = 100) -> dict:
    """EventsQuery (raw events table) filtered to one event type via HogQL."""
    return {
        "kind": "EventsQuery",
        "select": ["*"],
        "where": [f"event = '{event}'"],
        "orderBy": ["-timestamp"],
        "limit": limit,
        # EventsQuery has no `dateRange` field (rejected by the API); the
        # relative window is `after` (verified 2026-09-28).
        "after": "-30d",
    }


def tile(name: str, description: str, query: dict) -> dict:
    """One dashboard tile = one insight payload."""
    return {"name": name, "description": description, "query": query}


# ---------------------------------------------------------------------------
# Dashboard definitions
# ---------------------------------------------------------------------------

DASHBOARDS: list[dict] = [
    # (a) Content & engagement ----------------------------------------------
    {
        "name": "Контент и вовлечение",
        "description": (
            "Контент и вовлечение за 30 дней: чтение постов, глубина "
            "дочитывания, поиск, ask-me, случайный пост."
        ),
        "tiles": [
            tile(
                "post_read по slug",
                "Сколько раз читали каждый пост за 30 дней (breakdown по slug).",
                trends_query([events_node("post_read", math="total")], breakdown=["slug"]),
            ),
            tile(
                "read_depth: 50% и 100%",
                "Число достижений глубины 50 и 100 (свойство depth, event-свойство, числа).",
                trends_query(
                    [
                        events_node("read_depth", math="total", properties=[prop("depth", 50)]),
                        events_node("read_depth", math="total", properties=[prop("depth", 100)]),
                    ]
                ),
            ),
            tile(
                "search_used vs search_no_results",
                "Успешные и пустые поиски, две серии, 30 дней.",
                trends_query(
                    [
                        events_node("search_used", math="total"),
                        events_node("search_no_results", math="total"),
                    ]
                ),
            ),
            tile(
                "Топ поисковых запросов (search_used)",
                "Таблица последних событий search_used (ограничена 100 строками).",
                events_query("search_used", limit=100),
            ),
            tile(
                "ask_me_used: всего и с совпадением",
                "Две серии: все ask_me_used и те, где answer_matched = true; "
                "отношение читается визуально как доля точных ответов.",
                trends_query(
                    [
                        events_node("ask_me_used", math="total"),
                        events_node(
                            "ask_me_used",
                            math="total",
                            properties=[prop("answer_matched", True)],
                        ),
                    ]
                ),
            ),
            tile(
                "random_post_click",
                "Клики по случайному посту, 30 дней.",
                trends_query([events_node("random_post_click", math="total")]),
            ),
        ],
    },
    # (b) RU vs EN -----------------------------------------------------------
    {
        "name": "RU vs EN",
        "description": (
            "Разделение трафика и ключевых событий по локали. locale — "
            "super property на каждом событии; RU = корневые пути, EN = /en/."
        ),
        "tiles": [
            tile(
                "$pageview по locale",
                "Просмотры страниц с разбивкой по locale, 30 дней.",
                trends_query([events_node("$pageview", math="total")], breakdown=["locale"]),
            ),
            tile(
                "lang_switched",
                "Переключения языка, 30 дней.",
                trends_query([events_node("lang_switched", math="total")]),
            ),
            tile(
                "project_viewed по locale",
                "Просмотры кейсов по локали, 30 дней.",
                trends_query([events_node("project_viewed", math="total")], breakdown=["locale"]),
            ),
            tile(
                "Контактные события по locale",
                "cv_download_pdf, telegram_contact, booking_click с разбивкой по locale.",
                trends_query(
                    [
                        events_node("cv_download_pdf", math="total"),
                        events_node("telegram_contact", math="total"),
                        events_node("booking_click", math="total"),
                    ],
                    breakdown=["locale"],
                ),
            ),
        ],
    },
    # (c) Contact conversion (30d) ------------------------------------------
    {
        "name": "Контакт-конверсия 30д",
        "description": (
            "Воронка контакт-конверсии за 30 дней и тренды контактных CTA. "
            "North Star — контакты/мес, прокси — CTR резюме (cv_download_pdf). "
            "Воронка закодирована одиночными событиями на шаг: "
            "$pageview '/' → project_viewed → cv_download_pdf. "
            "OR-наборы на шаг (project_viewed ИЛИ $pageview /projects/; "
            "cv_download_pdf ИЛИ telegram_contact ИЛИ booking_click ИЛИ "
            "contact_submit) базовым FunnelsQuery не выражаются — см. README."
        ),
        "tiles": [
            tile(
                "Воронка: главная → проект → CTA",
                "Шаг 1: $pageview ($pathname = '/'), шаг 2: project_viewed, "
                "шаг 3: cv_download_pdf. Сравнение по времени первого события "
                "(first_ts) — как у существующей воронки zlXsA98W.",
                funnels_query(
                    [
                        events_node("$pageview", properties=[prop("$pathname", "/")]),
                        events_node("project_viewed"),
                        events_node("cv_download_pdf"),
                    ]
                ),
            ),
            tile(
                "Тренды контактных CTA",
                "cv_download_pdf, telegram_contact, booking_click, contact_submit — "
                "по одной серии на событие, 30 дней.",
                trends_query(
                    [
                        events_node("cv_download_pdf", math="total"),
                        events_node("telegram_contact", math="total"),
                        events_node("booking_click", math="total"),
                        events_node("contact_submit", math="total"),
                    ]
                ),
            ),
            tile(
                "outbound_click по доменам",
                "Уходящие клики с разбивкой по домену (github, t.me, linkedin и т.п.).",
                trends_query([events_node("outbound_click", math="total")], breakdown=["domain"]),
            ),
            tile(
                "$pageview по utm_source",
                "Трафик по источникам: utm_source автозахватывается на $pageview "
                "(без $-префикса), event-свойство.",
                trends_query([events_node("$pageview", math="total")], breakdown=["utm_source"]),
            ),
        ],
    },
    # (d) Games --------------------------------------------------------------
    {
        "name": "Games",
        "description": (
            "События игрового хаба (public/games, отдельный init PostHog): "
            "запуски, воронка selected → started → win, daily, переходы в контакты."
        ),
        "tiles": [
            tile(
                "game_started: уникальные пользователи по игре",
                "Unique users на game_started с разбивкой по свойству game.",
                trends_query(
                    [events_node("game_started", math="dau")], breakdown=["game"]
                ),
            ),
            tile(
                "Воронка: selected → started → win",
                "Три шага: game_selected → game_started → game_win, unique users, 30 дней.",
                funnels_query(
                    [
                        events_node("game_selected"),
                        events_node("game_started"),
                        events_node("game_win"),
                    ]
                ),
            ),
            tile(
                "daily_completed",
                "Тренд ежедневных завершений daily-режима, 30 дней.",
                trends_query([events_node("daily_completed", math="total")]),
            ),
            tile(
                "contact_click по каналам",
                "Клики в контакт из игр с разбивкой по свойству channel.",
                trends_query([events_node("contact_click", math="total")], breakdown=["channel"]),
            ),
        ],
    },
]


# ---------------------------------------------------------------------------
# HTTP plumbing (stdlib only; the API key is used in a header and never printed)
# ---------------------------------------------------------------------------


def api_request(method: str, url: str, api_key: str, payload: dict | None = None) -> dict | None:
    """Perform an API call. Returns parsed JSON or None on any error.

    Errors (including 4xx bodies) are printed to stderr; the caller continues
    so a single bad payload never crashes the whole run.
    """
    data = None
    headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.HTTPError as err:
        try:
            body = err.read().decode("utf-8", "replace")
        except Exception:  # noqa: BLE001 — error body is best-effort diagnostics
            body = "<no body>"
        print(f"ERROR {err.code} {method} {url}: {body}", file=sys.stderr)
        return None
    except urllib.error.URLError as err:
        print(f"ERROR {method} {url}: {err.reason}", file=sys.stderr)
        return None
    return json.loads(body) if body.strip() else {}


def list_dashboard_names(base: str, api_key: str) -> set[str] | None:
    """{name: id} of all existing dashboards, following pagination.

    Returns None if the listing fails (so apply can abort and stay idempotent).
    """
    names: dict[str, object] = {}
    url: str | None = f"{base}/dashboards/?limit=100"
    while url:
        data = api_request("GET", url, api_key)
        if data is None:
            return None
        for dash in data.get("results", []):
            names[dash.get("name")] = dash.get("id")
        url = data.get("next")
    return names


def attach_tile(base: str, api_key: str, dashboard_id, insight_id) -> bool:
    """Attach an insight to a dashboard.

    Verified against us.posthog.com (2026-09-28): the nested
    POST /dashboards/{id}/tiles/ endpoint does NOT exist (404), and PATCHing the
    dashboard's `tiles` list returns 200 while silently changing nothing. The
    working route is PATCHing the *insight* with `dashboards: [dashboard_id]`.
    """
    result = api_request(
        "PATCH",
        f"{base}/insights/{insight_id}/",
        api_key,
        {"dashboards": [dashboard_id]},
    )
    return result is not None


def apply_mode(base: str, api_key: str, dashboards: list[dict]) -> None:
    """Create dashboards, insights, and tiles over the network."""
    existing = list_dashboard_names(base, api_key)
    if existing is None:
        print("Could not list dashboards; aborting to stay idempotent.", file=sys.stderr)
        sys.exit(1)

    for dash_spec in dashboards:
        name = dash_spec["name"]
        if name in existing:
            dashboard_id = existing[name]
            print(f"[{name}] exists id={dashboard_id}, reusing (adding tiles)")
        else:
            dashboard = api_request(
                "POST",
                f"{base}/dashboards/",
                api_key,
                {"name": name, "description": dash_spec["description"]},
            )
            if dashboard is None:
                print(f"[{name}] dashboard creation failed, skipping its tiles", file=sys.stderr)
                continue
            dashboard_id = dashboard.get("id")
            print(f"[{name}] created id={dashboard_id}")

        for tile_spec in dash_spec["tiles"]:
            insight = api_request(
                "POST",
                f"{base}/insights/",
                api_key,
                {
                    "name": tile_spec["name"],
                    "description": tile_spec["description"],
                    "query": tile_spec["query"],
                },
            )
            if insight is None:
                print(f"  insight '{tile_spec['name']}' creation failed", file=sys.stderr)
                continue
            insight_id = insight.get("id")
            print(f"  insight '{tile_spec['name']}' created id={insight_id}")
            if attach_tile(base, api_key, dashboard_id, insight_id):
                print(f"  attached to dashboard {dashboard_id}")
            else:
                print(
                    f"  WARN: could not attach insight {insight_id}; "
                    "attach it manually in the PostHog UI",
                    file=sys.stderr,
                )


def dry_run(dashboards: list[dict]) -> None:
    """Print every payload the script would POST. Zero network calls."""
    for dash_spec in dashboards:
        name = dash_spec["name"]
        print(f"\n{'=' * 70}\nDRY RUN dashboard: {name}\n{'=' * 70}")
        print("-- POST /api/projects/{project_id}/dashboards/")
        print(
            json.dumps(
                {"name": name, "description": dash_spec["description"]},
                ensure_ascii=False,
                indent=2,
            )
        )
        for tile_spec in dash_spec["tiles"]:
            print(f"\n-- POST /api/projects/{{project_id}}/insights/  ({tile_spec['name']})")
            print(
                json.dumps(
                    {
                        "name": tile_spec["name"],
                        "description": tile_spec["description"],
                        "query": tile_spec["query"],
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
            print("-- POST /api/projects/{project_id}/dashboards/{dashboard_id}/tiles/")
            print(json.dumps({"insight": "<id of the insight created above>"}))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Provision PostHog dashboards for the Astro portfolio site."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually create objects (default is dry run: print payloads, no network).",
    )
    args = parser.parse_args()

    api_key = os.environ.get(API_KEY_ENV)
    # POSTHOG_HOST often carries the *ingestion* host (e.g. https://us.i.posthog.com,
    # exported for the capture SDK). The REST API lives on the app host instead,
    # so normalize "…i.posthog.com" → "…posthog.com" before use.
    host = os.environ.get("POSTHOG_HOST", DEFAULT_HOST).rstrip("/")
    host = host.replace(".i.posthog.com", ".posthog.com")
    host = host.replace("://i.posthog.com", "://posthog.com")
    project_id = os.environ.get("POSTHOG_PROJECT_ID", DEFAULT_PROJECT_ID)
    base = f"{host}/api/projects/{project_id}"

    if args.apply:
        if not api_key:
            print(f"ERROR: {API_KEY_ENV} is not set; cannot run --apply.", file=sys.stderr)
            sys.exit(1)
        print(f"Applying to {base} (project {project_id})")
        apply_mode(base, api_key, DASHBOARDS)
    else:
        print(f"DRY RUN (no network calls) for project {project_id} at {host}")
        print(f"Pass --apply to create the dashboards (requires {API_KEY_ENV}).")
        if not api_key:
            print(f"Note: {API_KEY_ENV} is not set — fine for a dry run.")
        dry_run(DASHBOARDS)


if __name__ == "__main__":
    main()