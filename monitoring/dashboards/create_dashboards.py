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
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

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


def events_node(
    event: str, math: str | None = None, properties: list | None = None
) -> dict:
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


def tile(name: str, description: str, query: dict, dynamic: bool = False) -> dict:
    """One dashboard tile = one insight payload.

    `dynamic=True` marks a tile whose query is generated from the repo (a list
    of event names, say). On --apply such a tile is re-synced when its stored
    query drifts from the generated one; every other tile is skipped when it
    already exists.
    """
    return {
        "name": name,
        "description": description,
        "query": query,
        "dynamic": dynamic,
    }


# ---------------------------------------------------------------------------
# Query-node builders, v2 (verified against us.posthog.com 2026-10-18)
# ---------------------------------------------------------------------------
# Differences from the v1 builders above, all verified live:
# - `breakdownFilter.breakdowns` (array of {type, property}) is what the API
#   actually stores; the v1 singular `breakdown` key is tolerated but is not
#   what current insights use. Two breakdowns are allowed.
# - `trendsFilter.display` picks the visual: ActionsLineGraph | ActionsTable |
#   ActionsPie | ActionsBar.
# - An "all events" series is `{"event": None}` — it counts everything,
#   including the SDK's own $events.
# - A funnel step can be a `GroupNode` (OR-set of EventsNode) — that is how a
#   multi-channel "contact" step is expressed.
# - HogQL tables are `DataTableNode` wrapping a bare `HogQLQuery`.
# - `InsightVizNode` only accepts Trends/Funnels/Retention/... nodes, NOT a
#   DataTableNode, so HogQL tiles are sent as a top-level DataTableNode.


def date_range_v2(days: int = 90) -> dict:
    return {"date_from": f"-{days}d", "explicitDate": False}


def node(
    event: str | None,
    math: str | None = None,
    properties: list | None = None,
    name: str | None = None,
) -> dict:
    """EventsNode for a trends series or a funnel step (event=None = all events)."""
    n: dict = {"kind": "EventsNode", "event": event}
    if math:
        n["math"] = math
    if properties:
        n["properties"] = properties
    if name:
        n["name"] = name
    return n


def prop_filter(
    key: str, value, operator: str = "exact", prop_type: str = "event"
) -> dict:
    return {"type": prop_type, "key": key, "value": value, "operator": operator}


def group(nodes: list, name: str | None = None) -> dict:
    """OR-set of nodes, usable as a single funnel step."""
    g: dict = {"kind": "GroupNode", "operator": "OR", "nodes": nodes}
    if name:
        g["name"] = name
    return g


def trends(
    series: list,
    breakdowns: list[str] | None = None,
    days: int = 90,
    interval: str = "day",
    display: str = "ActionsLineGraph",
    limit: int = 25,
) -> dict:
    """TrendsQuery with an explicit display and one or more event breakdowns."""
    query: dict = {
        "kind": "TrendsQuery",
        "series": series,
        "interval": interval,
        "dateRange": date_range_v2(days),
        "trendsFilter": {"display": display, "showLegend": display != "ActionsTable"},
        "filterTestAccounts": False,
    }
    if breakdowns:
        query["breakdownFilter"] = {
            "breakdowns": [{"type": "event", "property": p} for p in breakdowns],
            "breakdown_type": "event",
            "breakdown_limit": limit,
        }
    return query


def funnel(steps: list, days: int = 90, viz: str | None = None) -> dict:
    """FunnelsQuery (unique users by default; ordered, first-touch semantics)."""
    query: dict = {
        "kind": "FunnelsQuery",
        "series": steps,
        "dateRange": date_range_v2(days),
        "filterTestAccounts": False,
    }
    if viz:
        query["funnelsFilter"] = {"funnelVizType": viz}
    return query


def hogql_table(sql: str) -> dict:
    """DataTableNode over a HogQL query — for tables TrendsQuery cannot express."""
    return {
        "kind": "DataTableNode",
        "source": {"kind": "HogQLQuery", "query": sql.strip()},
    }


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
                trends_query(
                    [events_node("post_read", math="total")], breakdown=["slug"]
                ),
            ),
            tile(
                "read_depth: 50% и 100%",
                "Число достижений глубины 50 и 100 (свойство depth, event-свойство, числа).",
                trends_query(
                    [
                        events_node(
                            "read_depth", math="total", properties=[prop("depth", 50)]
                        ),
                        events_node(
                            "read_depth", math="total", properties=[prop("depth", 100)]
                        ),
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
                trends_query(
                    [events_node("$pageview", math="total")], breakdown=["locale"]
                ),
            ),
            tile(
                "lang_switched",
                "Переключения языка, 30 дней.",
                trends_query([events_node("lang_switched", math="total")]),
            ),
            tile(
                "project_viewed по locale",
                "Просмотры кейсов по локали, 30 дней.",
                trends_query(
                    [events_node("project_viewed", math="total")], breakdown=["locale"]
                ),
            ),
            tile(
                "Контактные события по locale",
                "telegram_contact, booking_click с разбивкой по locale.",
                trends_query(
                    [
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
            "North Star — контакты/мес. "
            "Воронка закодирована одиночными событиями на шаг: "
            "$pageview '/' → project_viewed → booking_click. "
            "OR-наборы на шаг (project_viewed ИЛИ $pageview /projects/; "
            "booking_click ИЛИ telegram_contact ИЛИ "
            "contact_submit) базовым FunnelsQuery не выражаются — см. README."
        ),
        "tiles": [
            tile(
                "Воронка: главная → проект → CTA",
                "Шаг 1: $pageview ($pathname = '/'), шаг 2: project_viewed, "
                "шаг 3: booking_click. Сравнение по времени первого события "
                "(first_ts) — как у существующей воронки zlXsA98W.",
                funnels_query(
                    [
                        events_node("$pageview", properties=[prop("$pathname", "/")]),
                        events_node("project_viewed"),
                        events_node("booking_click"),
                    ]
                ),
            ),
            tile(
                "Тренды контактных CTA",
                "telegram_contact, booking_click, contact_submit — "
                "по одной серии на событие, 30 дней.",
                trends_query(
                    [
                        events_node("telegram_contact", math="total"),
                        events_node("booking_click", math="total"),
                        events_node("contact_submit", math="total"),
                    ]
                ),
            ),
            tile(
                "outbound_click по доменам",
                "Уходящие клики с разбивкой по домену (github, t.me, linkedin и т.п.).",
                trends_query(
                    [events_node("outbound_click", math="total")], breakdown=["domain"]
                ),
            ),
            tile(
                "$pageview по utm_source",
                "Трафик по источникам: utm_source автозахватывается на $pageview "
                "(без $-префикса), event-свойство.",
                trends_query(
                    [events_node("$pageview", math="total")], breakdown=["utm_source"]
                ),
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
                trends_query(
                    [events_node("contact_click", math="total")], breakdown=["channel"]
                ),
            ),
        ],
    },
]


# ---------------------------------------------------------------------------
# Dashboard definitions, v2 (created 2026-10-18)
# ---------------------------------------------------------------------------
# These five dashboards replace the dead weight of the v1 set: every tile here
# runs against a query that returns data today (verified through
# POST /api/projects/{id}/query/ before the dashboards were created). The v1
# «Games» dashboard and four tiles of «Контент и вовлечение» are kept but are
# documented as dead in monitoring/dashboards/README.md — this script never
# deletes what it did not create.


def expected_events() -> list[str]:
    """Event names the repo claims to emit — the left side of the dead-event check.

    Read from the source of truth, not hand-maintained here:
      * `AnalyticsEventMap` keys in `src/lib/analytics.ts` (typed events),
      * the event tables of `docs/analytics-events.md` §1 and §2 (first-class +
        frozen CTA names),
      * the games bundle's hardcoded names (public/games/**).
    Template names (`project_demo_<slug>`) and input attributes
    (`lang_switch_*`, which the delegated handler maps to `lang_switched`) are
    excluded: neither is an event that can be counted as such.
    """
    root = Path(__file__).resolve().parents[2]
    names: set[str] = set()

    analytics_ts = (root / "src/lib/analytics.ts").read_text(encoding="utf-8")
    start = analytics_ts.index("export interface AnalyticsEventMap")
    block = analytics_ts[start : analytics_ts.index("\n}", start)]
    names.update(re.findall(r"^ {2}([a-z_][a-z0-9_]*):", block, re.M))

    docs = (root / "docs/analytics-events.md").read_text(encoding="utf-8")
    for section in ("## 1.", "## 2."):
        s = docs.index(section)
        rest = docs[s:]
        stop = re.search(r"\n#{2,3} ", rest)
        table = rest[: stop.start()] if stop else rest
        for line in table.splitlines():
            if not line.startswith("|"):
                continue
            first_cell = line.split("|")[1]
            names.update(re.findall(r"`([a-z_][a-z0-9_]*)`", first_cell))

    names.update(
        {
            "game_selected",
            "game_started",
            "game_over",
            "game_win",
            "daily_completed",
            "best_broken",
            "sig_reached",
            "experiment_started",
            "milestone",
            "contact_click",
        }
    )
    return sorted(n for n in names if not n.startswith("lang_switch_"))


def dead_events_query() -> str:
    """HogQL: every expected event with its 90-day volume, zeroes first."""
    names = expected_events()
    array = ", ".join(f"'{n}'" for n in names)
    return f"""
        WITH expected AS (SELECT arrayJoin([{array}]) AS event),
             agg AS (
                 SELECT event,
                        count() AS events,
                        uniq(distinct_id) AS users,
                        max(timestamp) AS last_seen
                 FROM events
                 WHERE timestamp > now() - INTERVAL 90 DAY
                 GROUP BY event
             )
        SELECT
            expected.event AS event,
            ifNull(agg.events, 0) AS events,
            ifNull(agg.users, 0) AS users,
            agg.last_seen AS last_seen
        FROM expected
        LEFT JOIN agg ON agg.event = expected.event
        ORDER BY events ASC, event ASC
        LIMIT 120
        """


# Every channel that counts as "the visitor contacted me".
CONTACT_EVENTS = [
    "booking_click",
    "telegram_contact",
    "telegram_deeplink",
    "telegram_footer",
    "linkedin_contact",
    "linkedin_footer",
    "github_footer",
]

# The homepage has been served from two base paths over the site's life
# (legacy `/Personal_Projects.github.io/` and current `/`); a funnel scoped to
# `/` alone misses the earlier traffic and every `/en/` visit.
HOME_STEP = group(
    [
        node("$pageview", properties=[prop_filter("$pathname", "/")], name="Home /"),
        node(
            "$pageview", properties=[prop_filter("$pathname", "/en/")], name="Home /en/"
        ),
        node(
            "$pageview",
            properties=[prop_filter("$pathname", "/Personal_Projects.github.io/")],
            name="Home (legacy base)",
        ),
    ],
    name="Главная (все базы и локали)",
)

CONTACT_STEP = group(
    [node(e, name=e) for e in CONTACT_EVENTS],
    name="Контакт (CV / Telegram / LinkedIn / GitHub / звонок)",
)

DASHBOARDS_V2: list[dict] = [
    # (1) Traffic & sources ---------------------------------------------------
    {
        "name": "01 · Трафик и источники",
        "description": (
            "Откуда приходят и что смотрят: недельная динамика, топ страниц, "
            "классифицированный первый реферрер, UTM из session entry, "
            "устройства. Все тайлы — 90 дней, если не сказано иное."
        ),
        "tiles": [
            tile(
                "Просмотры страниц (по неделям)",
                "Все $pageview по неделям, 90 дней — верхнеуровневый тренд трафика.",
                trends([node("$pageview", math="total")], interval="week"),
            ),
            tile(
                "Уникальные посетители (по неделям)",
                "Уникальные пользователи $pageview по неделям — реальный размер аудитории, в отличие от просмотров.",
                trends([node("$pageview", math="dau")], interval="week"),
            ),
            tile(
                "Топ страниц",
                "Просмотры по $pathname: видно, какие кейсы и разделы действительно читают.",
                trends(
                    [node("$pageview", math="total")],
                    breakdowns=["$pathname"],
                    display="ActionsTable",
                ),
            ),
            tile(
                "Внешние источники (домены)",
                "Просмотры по $referring_domain. Внутренний домен = навигация внутри сайта; "
                "github.com / linkedin.com / $direct — внешние источники.",
                trends(
                    [node("$pageview", math="total")],
                    breakdowns=["$referring_domain"],
                    display="ActionsTable",
                ),
            ),
            tile(
                "Первый источник (класс)",
                "Super property initial_referrer_class — классифицированный первый визит "
                "(linkedin/github/google/direct/other). Считается один раз на посетителя.",
                trends(
                    [node("$pageview", math="total")],
                    breakdowns=["initial_referrer_class"],
                    display="ActionsPie",
                ),
            ),
            tile(
                "UTM-кампании",
                "$session_entry_utm_source — UTM входа в сессию. Это правильный ключ: "
                "plain `utm_source` есть лишь на части событий, а session-entry — на всех.",
                trends(
                    [node("$pageview", math="total")],
                    breakdowns=["$session_entry_utm_source"],
                    display="ActionsTable",
                ),
            ),
            tile(
                "Устройства",
                "Просмотры по $device_type.",
                trends(
                    [node("$pageview", math="total")],
                    breakdowns=["$device_type"],
                    display="ActionsPie",
                ),
            ),
            tile(
                "Браузеры",
                "Просмотры по $browser. Desktop|Brave с сотнями просмотров — это трафик владельца "
                "и ботов; смотреть на долю Chrome/Safari для реальной аудитории.",
                trends(
                    [node("$pageview", math="total")],
                    breakdowns=["$browser"],
                    display="ActionsTable",
                ),
            ),
        ],
    },
    # (2) Funnel --------------------------------------------------------------
    {
        "name": "02 · Воронка: визит → проект → контакт",
        "description": (
            "Главная воронка портфолио за 90 дней. Шаг «контакт» — OR-набор всех "
            "каналов (CV, Telegram, LinkedIn, GitHub, звонок). Вторая воронка "
            "охватывает и `/`, и `/en/`, и легаси-базу `/Personal_Projects.github.io/`."
        ),
        "tiles": [
            tile(
                "Воронка: визит → project_viewed → контакт",
                "Шаг 1 — любое $pageview (все посетители), шаг 2 — project_viewed "
                "(любой surface), шаг 3 — OR-набор контактных событий.",
                funnel(
                    [
                        node("$pageview", name="Визит"),
                        node("project_viewed", name="Просмотр проекта"),
                        CONTACT_STEP,
                    ]
                ),
            ),
            tile(
                "Воронка: главная → проект → контакт",
                "Шаг 1 — главная как OR-набор путей (/ , /en/, /Personal_Projects.github.io/), "
                "шаги 2–3 как выше. Это исправленная версия старой воронки 11015002, "
                "которая считала только $pathname = '/' и теряла /en/ и легаси-базу.",
                funnel(
                    [
                        HOME_STEP,
                        node("project_viewed", name="Просмотр проекта"),
                        CONTACT_STEP,
                    ]
                ),
            ),
            tile(
                "Время до контакта",
                "Две ступени (визит → контакт), визуализация time-to-convert: медиана "
                "времени в секундах от входа до контакта.",
                funnel(
                    [node("$pageview", name="Визит"), CONTACT_STEP],
                    viz="time_to_convert",
                ),
            ),
            tile(
                "Конверсия главная → /projects/",
                "Две ступени: главная → любой $pageview с $pathname, содержащим projects. "
                "Показывает, доходит ли посетитель до списка кейсов.",
                funnel(
                    [
                        HOME_STEP,
                        node(
                            "$pageview",
                            properties=[
                                prop_filter(
                                    "$pathname", "projects", operator="icontains"
                                )
                            ],
                            name="/projects/",
                        ),
                    ]
                ),
            ),
            tile(
                "Контактные CTA по неделям",
                "По одной серии на канал контакта, недельный интервал — видно, какие каналы "
                "вообще используются (CV / Telegram / LinkedIn / GitHub / cal.com).",
                trends(
                    [node(e, math="total") for e in CONTACT_EVENTS], interval="week"
                ),
            ),
            tile(
                "Уходящие клики по доменам",
                "outbound_click по домену — куда уходят посетители (github, linkedin, t.me, cal.com).",
                trends(
                    [node("outbound_click", math="total")],
                    breakdowns=["domain"],
                    display="ActionsTable",
                ),
            ),
        ],
    },
    # (3) Projects & content --------------------------------------------------
    {
        "name": "03 · Проекты и контент",
        "description": (
            "Что читают: топ кейсов и статей, тип поверхности клика, глубина "
            "дочитывания, секции /about, фильтры, библиотека. 90 дней."
        ),
        "tiles": [
            tile(
                "Топ проектов",
                "project_viewed по slug — какие кейсы открывают.",
                trends(
                    [node("project_viewed", math="total")],
                    breakdowns=["slug"],
                    display="ActionsTable",
                ),
            ),
            tile(
                "project_viewed по surface",
                "Откуда открыт кейс: page (страница), card (карточка), list (список), "
                "unknown (клик без data-analytics-surface). Большой unknown — повод доразметить.",
                trends(
                    [node("project_viewed", math="total")],
                    breakdowns=["surface"],
                    display="ActionsPie",
                ),
            ),
            tile(
                "Топ статей",
                "post_read по slug — какие посты доходят хотя бы до открытия страницы.",
                trends(
                    [node("post_read", math="total")],
                    breakdowns=["slug"],
                    display="ActionsTable",
                ),
            ),
            tile(
                "Глубина чтения (25/50/75/100)",
                "read_depth по свойству depth. Сравнивать с README: глубина есть только там, "
                "где сработал scroll-порог, поэтому 100 всегда меньше 25.",
                trends(
                    [node("read_depth", math="total")],
                    breakdowns=["depth"],
                    display="ActionsBar",
                ),
            ),
            tile(
                "Глубина чтения по типу контента",
                "read_depth по content_type: case_study / post / note — видно, где контент дочитывают.",
                trends(
                    [node("read_depth", math="total")],
                    breakdowns=["content_type"],
                    display="ActionsTable",
                ),
            ),
            tile(
                "Секции /about",
                "section_viewed по секции — какие части страницы «о себе» реально просматривают.",
                trends(
                    [node("section_viewed", math="total")],
                    breakdowns=["section"],
                    display="ActionsTable",
                ),
            ),
            tile(
                "Фильтры по поверхностям",
                "filter_applied по surface: writing (теги блога) vs glossary (буквы глоссария).",
                trends(
                    [node("filter_applied", math="total")],
                    breakdowns=["surface"],
                    display="ActionsTable",
                ),
            ),
            tile(
                "Поиск: попадания и пустые",
                "Честно пусто на 2026-10-18: search_used / search_no_results = 0 строк за 90 дней — "
                "панель поиска просто не открывают. Тайл нужен, чтобы это было видно до того, как "
                "кто-то начнёт «улучшать поиск». Свойство surface (header — общесайтовый SearchBox, "
                "glossary — фильтр глоссария) добавлено 2026-10-18: до него два разных поиска "
                "сливались в одну серию.",
                trends(
                    [
                        node("search_used", math="total"),
                        node("search_no_results", math="total"),
                    ],
                    breakdowns=["surface"],
                    display="ActionsTable",
                ),
            ),
            tile(
                "Библиотека",
                "library_tile — клики по плиткам библиотеки (событие уже было в коде, "
                "но отсутствовало в типизированной карте и в docs).",
                trends([node("library_tile", math="total")]),
            ),
        ],
    },
    # (4) Personas & CTA ------------------------------------------------------
    {
        "name": "04 · Персоны и CTA",
        "description": (
            "Гейт персон и главная CTA: показы, выбор, источник выбора, языковая "
            "и тематическая разбивка. 90 дней."
        ),
        "tiles": [
            tile(
                "Гейт: показы и уникальные посетители",
                "persona_gate_view — всего и уникальных (две серии). Разница показывает, "
                "сколько раз карточка показывается одному человеку.",
                trends(
                    [
                        node("persona_gate_view", math="total"),
                        node("persona_gate_view", math="dau"),
                    ],
                    interval="week",
                ),
            ),
            tile(
                "Выбор персоны",
                "persona_selected по persona (hr / manager / colleague).",
                trends(
                    [node("persona_selected", math="total")],
                    breakdowns=["persona"],
                    display="ActionsTable",
                ),
            ),
            tile(
                "Воронка: gate → выбор персоны",
                "Две ступени: persona_gate_view → persona_selected, уникальные пользователи.",
                funnel(
                    [
                        node("persona_gate_view", name="Показ гейта"),
                        node("persona_selected", name="Выбор персоны"),
                    ]
                ),
            ),
            tile(
                "Источник выбора персоны",
                "persona_selected по source: gate (карточка на главной), switch (переключатель ролей), "
                "header / menu (навигация NavRoles). Значения header/menu добавлены в тип 2026-10-18 — "
                "до этого карта событий обещала только gate|switch.",
                trends(
                    [node("persona_selected", math="total")],
                    breakdowns=["source"],
                    display="ActionsTable",
                ),
            ),
            tile(
                "RU vs EN: просмотры",
                "$pageview по locale (super property). null — события до появления super-properties.",
                trends(
                    [node("$pageview", math="total")],
                    breakdowns=["locale"],
                    display="ActionsTable",
                ),
            ),
            tile(
                "Переключения языка",
                "lang_switched по целевому языку (to): сколько раз уходили в EN / возвращались в RU.",
                trends(
                    [node("lang_switched", math="total")],
                    breakdowns=["to"],
                    display="ActionsTable",
                ),
            ),
            tile(
                "Тема оформления",
                "theme_change по theme — какие темы переключают. Помни: свойство theme "
                "на самом событии — уже НОВАЯ тема (обработчик переключает её до capture).",
                trends(
                    [node("theme_change", math="total")],
                    breakdowns=["theme"],
                    display="ActionsTable",
                ),
            ),
            tile(
                "CTA rail: экспозиция → клик",
                "Две ступени: cta_exposure (surface=home_rail) → cv_download_pdf "
                "(surface=home_rail). Пара соединяется по surface с 2026-10-18: rail-ссылка "
                "несёт data-analytics-surface. До деплоя правая ступень = 0, и это "
                "ожидаемо, а не сломанный тайл.",
                funnel(
                    [
                        node(
                            "cta_exposure",
                            properties=[prop_filter("surface", "home_rail")],
                            name="Экспозиция rail",
                        ),
                        node(
                            "cv_download_pdf",
                            properties=[prop_filter("surface", "home_rail")],
                            name="Клик по CV из rail",
                        ),
                    ]
                ),
            ),
            tile(
                "CTA-экспозиция (десктоп ≥1860px)",
                "cta_exposure — знаменатель для rate экспозиция→клик. Огонь только на главной "
                "и только при ширине ≥1860px, surface = home_rail; клик (cv_download_pdf) "
                "несёт лишь {path}, поэтому пара не соединяется по общему свойству.",
                trends([node("cta_exposure", math="total")], interval="week"),
            ),
        ],
    },
    # (5) Analytics health ----------------------------------------------------
    {
        "name": "05 · Здоровье аналитики",
        "description": (
            "Мета-дашборд: объём по событиям (видно мёртвую инструментацию), "
            "доля мусорных событий от своих же пайплайнов, Web Vitals, rageclick, "
            "ошибки JS. Смотреть перед каждым недельным ревью: если событие здесь "
            "равно нулю, тайл в других дашбордах читать нечем."
        ),
        "tiles": [
            tile(
                "Объём по событиям (90д)",
                "event / число / уникальные пользователи / последнее событие. Одна таблица "
                "отвечает на вопрос «какие события вообще существуют»: нули здесь = "
                "мёртвая инструментация или неиспользуемая фича.",
                hogql_table(
                    """
                    SELECT
                        event,
                        count() AS events,
                        uniq(distinct_id) AS users,
                        max(timestamp) AS last_seen
                    FROM events
                    WHERE timestamp > now() - INTERVAL 90 DAY
                    GROUP BY event
                    ORDER BY events DESC
                    LIMIT 80
                    """
                ),
            ),
            tile(
                "Ожидаемые, но мёртвые события (90д)",
                "Сверка кода с данными. Список имён собран из AnalyticsEventMap, таблиц "
                "docs/analytics-events.md §1–§2 и игрового бандла; тайл синхронизируется "
                "при каждом `--apply`. events = 0 означает одно из трёх: событие объявлено "
                "и не задеплоено (surface у поиска, surface у rail-CTA), фича инертна "
                "(contact_submit при выключенной форме), или код мёртв (headline_*). "
                "Сверху — самые мёртвые.",
                hogql_table(dead_events_query()),
                dynamic=True,
            ),
            tile(
                "События в день (все типы)",
                "Все события по дням, включая $autocapture и SDK-события. Даёт базовый "
                "объём: резкий рост без роста точек входа = мусор, падение = сломанный capture.",
                trends([node(None, math="total")], interval="day"),
            ),
            tile(
                "Мусорные события (свои пайплайны)",
                "События, которые пишет не сайт, а собственные тулы: $ai_generation ($ai_*), "
                "$scout_report_edited ($scout_*), $recording_observed, eng_analytics_test_census. "
                "Они искажают общий объём и не должны попадать в продуктовые воронки.",
                trends(
                    [
                        node("$ai_generation", math="total"),
                        node("$scout_report_edited", math="total"),
                        node("$recording_observed", math="total"),
                        node("eng_analytics_test_census", math="total"),
                    ],
                    interval="week",
                ),
            ),
            tile(
                "Web Vitals p75 по страницам (30д)",
                "LCP/INP/CLS/FCP p75 по путям, 30 дней. LCP в секундах. Пути с <10 замерами "
                "шумят — смотреть на топ.",
                hogql_table(
                    """
                    SELECT
                        properties.$pathname AS path,
                        count() AS samples,
                        round(quantile(0.75)(properties.$web_vitals_LCP_value / 1000.0), 2) AS lcp_p75_s,
                        round(quantile(0.75)(properties.$web_vitals_INP_value / 1000.0), 2) AS inp_p75_s,
                        round(quantile(0.75)(properties.$web_vitals_CLS_value), 3) AS cls_p75
                    FROM events
                    WHERE event = '$web_vitals'
                      AND timestamp > now() - INTERVAL 30 DAY
                    GROUP BY path
                    HAVING samples >= 3
                    ORDER BY samples DESC
                    LIMIT 30
                    """
                ),
            ),
            tile(
                "Rageclick по страницам",
                "$rageclick по $pathname — места, где интерфейс не отвечает ожиданиям.",
                trends(
                    [node("$rageclick", math="total")],
                    breakdowns=["$pathname"],
                    display="ActionsTable",
                ),
            ),
            tile(
                "Ошибки JS",
                "$exception — захват включён с 12.10.2026 (capture_exceptions + opt-in проекта). "
                "Ноль строк = либо ошибок нет, либо opt-in не сработал.",
                trends([node("$exception", math="total")], interval="week"),
            ),
            tile(
                "Игровой хаб",
                "game_selected / game_started / game_over. С 2026-10-18 игры используют ту же "
                "persistence, что и сайт (было 'memory' — каждый игровой экран получал новый "
                "анонимный distinct_id и события не соединялись с сессией сайта).",
                trends(
                    [
                        node("game_selected", math="total"),
                        node("game_started", math="total"),
                        node("game_over", math="total"),
                    ],
                    interval="week",
                ),
            ),
        ],
    },
]


# ---------------------------------------------------------------------------
# HTTP plumbing (stdlib only; the API key is used in a header and never printed)
# ---------------------------------------------------------------------------


def api_request(
    method: str, url: str, api_key: str, payload: dict | None = None
) -> dict | None:
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


def existing_tiles(base: str, api_key: str, dashboard_id) -> dict[str, dict] | None:
    """Name → {"id", "query"} for the insights already on a dashboard.

    Needed for per-tile idempotency: re-running --apply must not duplicate
    insights on a dashboard that already exists (the v1 behaviour was to append
    a second copy of every tile), and a `dynamic` tile must be re-synced when the
    query generated from the repo drifts from the stored one.

    Returns None when the read fails. That distinction matters: treating a failed
    GET as "no tiles" makes the caller re-create every tile and duplicate the
    dashboard, which is exactly what happened on 2026-10-18 when the API dropped
    a connection mid-run.
    """
    dash = api_request("GET", f"{base}/dashboards/{dashboard_id}/", api_key)
    if dash is None:
        return None
    tiles: dict[str, dict] = {}
    for tile in dash.get("tiles") or []:
        insight = tile.get("insight") or {}
        name = insight.get("name")
        if name:
            tiles[name] = {"id": insight.get("id"), "query": insight.get("query")}
    return tiles


def _hogql(node: dict | None) -> str | None:
    """The SQL of a DataTableNode/HogQLQuery node, whitespace-normalised."""
    if not isinstance(node, dict):
        return None
    if node.get("kind") == "DataTableNode":
        node = node.get("source") or {}
    if node.get("kind") != "HogQLQuery":
        return None
    return " ".join(str(node.get("query", "")).split())


def dynamic_query_equal(stored: dict | None, wanted: dict) -> bool:
    """True when a dynamic tile's stored query already matches the generated one.

    HogQL tiles are compared on their SQL only: PostHog normalises the rest of
    the node (adds `version`, defaults) on save, so a full JSON compare would
    report drift on every run.
    """
    stored_sql, wanted_sql = _hogql(stored), _hogql(wanted)
    if stored_sql is not None and wanted_sql is not None:
        return stored_sql == wanted_sql
    return json.dumps(stored, sort_keys=True) == json.dumps(wanted, sort_keys=True)


def apply_mode(base: str, api_key: str, dashboards: list[dict]) -> None:
    """Create dashboards, insights, and tiles over the network (idempotent)."""
    existing = list_dashboard_names(base, api_key)
    if existing is None:
        print(
            "Could not list dashboards; aborting to stay idempotent.", file=sys.stderr
        )
        sys.exit(1)

    created_insights = 0
    synced_tiles = 0
    skipped_tiles = 0
    failed: list[tuple[str, str]] = []

    for dash_spec in dashboards:
        name = dash_spec["name"]
        if name in existing:
            dashboard_id = existing[name]
            present = existing_tiles(base, api_key, dashboard_id)
            if present is None:
                print(
                    f"[{name}] could not read its tiles; skipping the dashboard "
                    "rather than risk duplicating them",
                    file=sys.stderr,
                )
                failed.append((name, "<tiles read>"))
                continue
            print(f"[{name}] exists id={dashboard_id}, tiles present={len(present)}")
        else:
            dashboard = api_request(
                "POST",
                f"{base}/dashboards/",
                api_key,
                {"name": name, "description": dash_spec["description"]},
            )
            if dashboard is None:
                print(
                    f"[{name}] dashboard creation failed, skipping its tiles",
                    file=sys.stderr,
                )
                failed.append((name, "<dashboard>"))
                continue
            dashboard_id = dashboard.get("id")
            present = {}
            print(f"[{name}] created id={dashboard_id}")

        for tile_spec in dash_spec["tiles"]:
            tile_name = tile_spec["name"]
            existing_tile = present.get(tile_name)

            if existing_tile:
                if tile_spec.get("dynamic") and not dynamic_query_equal(
                    existing_tile.get("query"), tile_spec["query"]
                ):
                    updated = api_request(
                        "PATCH",
                        f"{base}/insights/{existing_tile['id']}/",
                        api_key,
                        {
                            "query": tile_spec["query"],
                            "description": tile_spec["description"],
                        },
                    )
                    if updated is None:
                        failed.append((name, f"{tile_name} (sync)"))
                    else:
                        synced_tiles += 1
                        print(f"  sync  '{tile_name}' (query drifted, re-synced)")
                    continue
                skipped_tiles += 1
                print(f"  skip  '{tile_name}' (already on the dashboard)")
                continue

            insight = api_request(
                "POST",
                f"{base}/insights/",
                api_key,
                {
                    "name": tile_name,
                    "description": tile_spec["description"],
                    "query": tile_spec["query"],
                },
            )
            if insight is None:
                print(f"  insight '{tile_name}' creation failed", file=sys.stderr)
                failed.append((name, tile_name))
                continue
            insight_id = insight.get("id")
            created_insights += 1
            print(f"  insight '{tile_name}' created id={insight_id}")
            if attach_tile(base, api_key, dashboard_id, insight_id):
                print(f"  attached to dashboard {dashboard_id}")
            else:
                print(
                    f"  WARN: could not attach insight {insight_id}; "
                    "attach it manually in the PostHog UI",
                    file=sys.stderr,
                )
                failed.append((name, f"{tile_name} (attach)"))

    print(
        f"\ncreated insights: {created_insights}, "
        f"re-synced: {synced_tiles}, "
        f"skipped (already present): {skipped_tiles}"
    )
    if failed:
        print(f"FAILURES ({len(failed)}): {failed}", file=sys.stderr)
        sys.exit(1)
    print("Re-run --apply is safe: every tile is created at most once.")
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
            print(
                f"\n-- POST /api/projects/{{project_id}}/insights/  ({tile_spec['name']})"
            )
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
    parser.add_argument(
        "--only",
        choices=["v1", "v2", "all"],
        default="v2",
        help=(
            "Which set to provision. v1 = the 2026-09-28 set (four dashboards, "
            "kept for reference), v2 = the 2026-10-18 set (five data-backed "
            "dashboards, the default), all = both."
        ),
    )
    args = parser.parse_args()

    if args.only == "v1":
        dashboards = DASHBOARDS
    elif args.only == "v2":
        dashboards = DASHBOARDS_V2
    else:
        dashboards = DASHBOARDS + DASHBOARDS_V2

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
            print(
                f"ERROR: {API_KEY_ENV} is not set; cannot run --apply.", file=sys.stderr
            )
            sys.exit(1)
        print(f"Applying to {base} (project {project_id})")
        apply_mode(base, api_key, dashboards)
    else:
        print(f"DRY RUN (no network calls) for project {project_id} at {host}")
        print(f"Pass --apply to create the dashboards (requires {API_KEY_ENV}).")
        if not api_key:
            print(f"Note: {API_KEY_ENV} is not set — fine for a dry run.")
        dry_run(dashboards)


if __name__ == "__main__":
    main()
