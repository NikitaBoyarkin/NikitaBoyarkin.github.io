# RED-мониторинг портфолио на Prometheus — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Поднять локальный Prometheus-стек, который экспортирует RED-метрики (Rate, Errors, Duration) статичного Astro-портфолио в Prometheus exposition-формате в реальном времени.

**Architecture:** Один Python-сервис `red-exporter` (FastAPI + prometheus_client) с двумя ingest-путями: `POST /beacon` (push от `navigator.sendBeacon` → счётчики Rate/Errors real-time) и фоновый PostHog-poller (каждые 15с → gauges Duration из web-vitals p75). Один uvicorn-процесс / один порт 9100 = один `prometheus_client` registry. Prometheus + Grafana + cloudflared named tunnel в docker-compose. Security-граница: порт 9100 не published на хост; публично через cloudflared доступны только `/beacon` и `/healthz` (ingress path-filter), `/metrics` — только в docker-сети.

**Tech Stack:** Python 3.12, FastAPI, uvicorn, prometheus_client, requests; Astro (existing site), TypeScript, vitest; Docker, docker-compose; prom/prometheus, grafana/grafana, cloudflare/cloudflared.

**Spec:** `docs/superpowers/specs/2026-09-12-red-prometheus-monitoring-design.md`

## Global Constraints

- Все новые файлы Python-экспортёра — в `monitoring/exporter/red_exporter/` (пакет) + `monitoring/exporter/tests/`.
- Astro-сниппет: `src/components/BeaconMetrics.astro` + `src/lib/beacon.ts`; подключается в layout сайта.
- `monitoring/` НЕ попадает в Astro-сборку (вне `src/`/`public/`); на деплой Pages не влияет.
- Язык: код/конфиги/metric-имена — английский; комментарии/README — русский где уместно.
- PostHog pull требует **personal API key** (`POSTHOG_API_KEY`), не публичный project token.
- Один uvicorn-процесс на порт 9100 ( НЕ два процесса — registry должен быть общим).
- Метрики именуются `portfolio_*` (см. §4 spec); типы Counter/Gauge строго по spec.
- Тесты: pytest для экспортёра, vitest для beacon.ts (уже настроен в портфолио).
- TDD: сначала failing-тест, потом реализация. Каждый таск заканчивается коммитом.

---

## File Structure

```
monitoring/
  docker-compose.yml                      # Task 8
  Makefile                                # Task 10
  README.md                               # Task 10
  .env.example                            # Task 1
  prometheus/prometheus.yml               # Task 8
  cloudflared/config.yml                  # Task 10
  grafana/provisioning/
    datasources/prometheus.yml            # Task 9
    dashboards/red-dashboard.json         # Task 9
  exporter/
    pyproject.toml                        # Task 1
    Dockerfile                            # Task 7
    entrypoint.sh                         # Task 7
    red_exporter/
      __init__.py                         # Task 1
      config.py                           # Task 1
      metrics.py                          # Task 2
      beacon.py                           # Task 3
      posthog_pull.py                     # Task 4
      app.py                              # Task 5
    tests/
      conftest.py                         # Task 1
      test_config.py                      # Task 1
      test_metrics.py                     # Task 2
      test_beacon.py                       # Task 3
      test_posthog_pull.py                 # Task 4
      test_app.py                          # Task 5
src/lib/beacon.ts                         # Task 6
src/components/BeaconMetrics.astro       # Task 6
tests/lib/beacon.test.ts                  # Task 6
```

---

## Task 1: Scaffolding + config module

**Files:**
- Create: `monitoring/exporter/pyproject.toml`
- Create: `monitoring/exporter/red_exporter/__init__.py` (empty)
- Create: `monitoring/exporter/red_exporter/config.py`
- Create: `monitoring/exporter/tests/conftest.py`
- Create: `monitoring/exporter/tests/test_config.py`
- Create: `monitoring/.env.example`

**Interfaces:**
- Produces: `red_exporter.config.Settings` (dataclass with fields below); later tasks import `from red_exporter.config import get_settings`.

- [ ] **Step 1: Write the failing test**

`monitoring/exporter/tests/test_config.py`:
```python
import os
from red_exporter.config import get_settings

def test_settings_load_from_env(monkeypatch):
    monkeypatch.setenv("POSTHOG_API_KEY", "phx_test_key")
    monkeypatch.setenv("POSTHOG_PROJECT_ID", "451732")
    monkeypatch.setenv("POSTHOG_HOST", "https://us.posthog.com")
    monkeypatch.setenv("POSTHOG_PULL_INTERVAL", "15")
    monkeypatch.setenv("POSTHOG_PULL_WINDOW", "30m")
    monkeypatch.setenv("SITE_ORIGIN", "https://nikitaboyarkin.github.io")
    monkeypatch.setenv("BEACON_PORT", "9100")
    s = get_settings()
    assert s.posthog_api_key == "phx_test_key"
    assert s.posthog_project_id == "451732"
    assert s.posthog_pull_interval == 15
    assert s.site_origin == "https://nikitaboyarkin.github.io"
    assert s.beacon_port == 9100
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd monitoring/exporter && uv run pytest tests/test_config.py -v` (or `python -m pytest`)
Expected: FAIL — `ModuleNotFoundError: red_exporter.config`

- [ ] **Step 3: Write minimal implementation**

`monitoring/exporter/red_exporter/config.py`:
```python
from __future__ import annotations
import os
from dataclasses import dataclass

@dataclass(frozen=True)
class Settings:
    posthog_api_key: str
    posthog_project_id: str
    posthog_host: str
    posthog_pull_interval: int
    posthog_pull_window: str
    site_origin: str
    beacon_port: int

def get_settings() -> Settings:
    return Settings(
        posthog_api_key=os.environ["POSTHOG_API_KEY"],
        posthog_project_id=os.environ["POSTHOG_PROJECT_ID"],
        posthog_host=os.environ.get("POSTHOG_HOST", "https://us.posthog.com"),
        posthog_pull_interval=int(os.environ.get("POSTHOG_PULL_INTERVAL", "15")),
        posthog_pull_window=os.environ.get("POSTHOG_PULL_WINDOW", "30m"),
        site_origin=os.environ.get("SITE_ORIGIN", "*"),
        beacon_port=int(os.environ.get("BEACON_PORT", "9100")),
    )
```

`monitoring/exporter/tests/conftest.py`:
```python
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
```

`monitoring/exporter/pyproject.toml`:
```toml
[project]
name = "red-exporter"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = ["fastapi>=0.110", "uvicorn[standard]>=0.29", "prometheus-client>=0.20", "requests>=2.31"]
[project.optional-dependencies]
dev = ["pytest>=8", "httpx>=0.27"]
[tool.pytest.ini_options]
testpaths = ["tests"]
```

`monitoring/.env.example`:
```
# PostHog pull (Duration) — personal API key, NOT the public project token
POSTHOG_API_KEY=
POSTHOG_PROJECT_ID=451732
POSTHOG_HOST=https://us.posthog.com
POSTHOG_PULL_INTERVAL=15
POSTHOG_PULL_WINDOW=30m
# Beacon public endpoint (build-time, baked into the site)
PUBLIC_BEACON_ENDPOINT=https://metrics.ваш-домен/beacon
SITE_ORIGIN=https://nikitaboyarkin.github.io
BEACON_PORT=9100
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd monitoring/exporter && uv sync && uv run pytest tests/test_config.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add monitoring/exporter/pyproject.toml monitoring/exporter/red_exporter/__init__.py monitoring/exporter/red_exporter/config.py monitoring/exporter/tests/conftest.py monitoring/exporter/tests/test_config.py monitoring/.env.example
git commit -m "feat(red-exporter): scaffold package + config module"
```

---

## Task 2: Metrics registry module

**Files:**
- Create: `monitoring/exporter/red_exporter/metrics.py`
- Create: `monitoring/exporter/tests/test_metrics.py`

**Interfaces:**
- Produces: `metrics.PAGEVIEWS` (Counter, labels path/locale), `metrics.SESSIONS`, `metrics.ACTIVE_SESSIONS` (Gauge), `metrics.JS_ERRORS` (Counter, labels path/type), `metrics.BEACON_FAILURES` (Counter, label reason), `metrics.LCP/INP/CLS/FCP` (Gauge, label path), `metrics.POSTHOG_PAGEVIEWS_30D`, `metrics.POSTHOG_PULL_ERRORS`, `metrics.POSTHOG_PULL_DURATION`, `metrics.EXPORTER_UP`.

- [ ] **Step 1: Write the failing test**

`monitoring/exporter/tests/test_metrics.py`:
```python
from prometheus_client import REGISTRY, generate_latest
from red_exporter import metrics

def test_pageviews_counter_has_labels():
    metrics.PAGEVIEWS.labels(path="/", locale="ru").inc()
    out = generate_latest(REGISTRY).decode()
    assert 'portfolio_pageviews_total{locale="ru",path="/"}' in out

def test_duration_gauges_exist():
    metrics.LCP.labels(path="/").set(1.542)
    out = generate_latest(REGISTRY).decode()
    assert 'portfolio_lcp_seconds{path="/"}' in out

def test_js_errors_labels():
    metrics.JS_ERRORS.labels(path="/", type="TypeError").inc()
    out = generate_latest(REGISTRY).decode()
    assert 'portfolio_js_errors_total{path="/",type="TypeError"}' in out
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd monitoring/exporter && uv run pytest tests/test_metrics.py -v`
Expected: FAIL — `AttributeError: module has no attribute 'PAGEVIEWS'`

- [ ] **Step 3: Write minimal implementation**

`monitoring/exporter/red_exporter/metrics.py`:
```python
from prometheus_client import Counter, Gauge

PAGEVIEWS = Counter("portfolio_pageviews_total", "Total pageviews", ["path", "locale"])
SESSIONS = Counter("portfolio_sessions_total", "Total sessions")
ACTIVE_SESSIONS = Gauge("portfolio_active_sessions", "Active sessions")
JS_ERRORS = Counter("portfolio_js_errors_total", "JS errors", ["path", "type"])
BEACON_FAILURES = Counter("portfolio_beacon_failures_total", "Beacon ingestion failures", ["reason"])

LCP = Gauge("portfolio_lcp_seconds", "LCP p75 (seconds)", ["path"])
INP = Gauge("portfolio_inp_seconds", "INP p75 (seconds)", ["path"])
CLS = Gauge("portfolio_cls", "CLS p75", ["path"])
FCP = Gauge("portfolio_fcp_seconds", "FCP p75 (seconds)", ["path"])
POSTHOG_PAGEVIEWS_30D = Gauge("portfolio_posthog_pageviews_30d", "PostHog pageviews last 30d")

POSTHOG_PULL_ERRORS = Counter("portfolio_posthog_pull_errors_total", "PostHog pull errors")
POSTHOG_PULL_DURATION = Gauge("portfolio_posthog_pull_duration_seconds", "PostHog pull duration (s)")
EXPORTER_UP = Gauge("portfolio_exporter_up", "Exporter up")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd monitoring/exporter && uv run pytest tests/test_metrics.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add monitoring/exporter/red_exporter/metrics.py monitoring/exporter/tests/test_metrics.py
git commit -m "feat(red-exporter): prometheus metric registry"
```

---

## Task 3: Beacon parsing + ingestion

**Files:**
- Create: `monitoring/exporter/red_exporter/beacon.py`
- Create: `monitoring/exporter/tests/test_beacon.py`

**Interfaces:**
- Produces: `beacon.parse_beacon(body: bytes) -> list[dict]` (raises `ValueError` on invalid JSON); `beacon.ingest_event(event: dict) -> None` (increments counters; on bad shape, increments `metrics.BEACON_FAILURES{reason=...}` and returns).

- [ ] **Step 1: Write the failing test**

`monitoring/exporter/tests/test_beacon.py`:
```python
import json
from prometheus_client import REGISTRY, generate_latest
from red_exporter import beacon, metrics

def _out():
    return generate_latest(REGISTRY).decode()

def test_parse_single_and_array():
    assert beacon.parse_beacon(b'{"type":"pageview"}') == [{"type": "pageview"}]
    assert beacon.parse_beacon(b'[{"type":"pageview"}]') == [{"type": "pageview"}]

def test_parse_invalid_raises():
    try:
        beacon.parse_beacon(b'not json')
        assert False
    except ValueError:
        pass

def test_ingest_pageview_increments_counter():
    before = _out().count('portfolio_pageviews_total{locale="ru",path="/"}')
    beacon.ingest_event({"type": "pageview", "path": "/", "locale": "ru", "session_id": "s1"})
    after = _out().count('portfolio_pageviews_total{locale="ru",path="/"}')
    assert after == before + 1

def test_ingest_error_event():
    before = _out().count('portfolio_js_errors_total{path="/",type="TypeError"}')
    beacon.ingest_event({"type": "error", "path": "/", "locale": "ru",
                          "error": {"type": "TypeError", "message": "x"}})
    after = _out().count('portfolio_js_errors_total{path="/",type="TypeError"}')
    assert after == before + 1

def test_ingest_bad_event_counts_failure():
    before_fail = _out().count('portfolio_beacon_failures_total{reason="bad_shape"}')
    beacon.ingest_event({"type": "unknown"})
    after_fail = _out().count('portfolio_beacon_failures_total{reason="bad_shape"}')
    assert after_fail == before_fail + 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd monitoring/exporter && uv run pytest tests/test_beacon.py -v`
Expected: FAIL — `ModuleNotFoundError` / missing `parse_beacon`

- [ ] **Step 3: Write minimal implementation**

`monitoring/exporter/red_exporter/beacon.py`:
```python
from __future__ import annotations
import json
from . import metrics

def parse_beacon(body: bytes) -> list[dict]:
    data = json.loads(body.decode("utf-8"))
    if isinstance(data, dict):
        return [data]
    if isinstance(data, list):
        return data
    raise ValueError("beacon payload must be object or array")

def ingest_event(event: dict) -> None:
    etype = event.get("type")
    path = event.get("path", "/")
    locale = event.get("locale", "unknown")
    if etype == "pageview":
        metrics.PAGEVIEWS.labels(path=path, locale=locale).inc()
        sid = event.get("session_id")
        if sid:
            metrics.SESSIONS.inc()
    elif etype == "error":
        etype_err = event.get("error", {}).get("type", "unknown")
        metrics.JS_ERRORS.labels(path=path, type=etype_err).inc()
    else:
        metrics.BEACON_FAILURES.labels(reason="bad_shape").inc()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd monitoring/exporter && uv run pytest tests/test_beacon.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add monitoring/exporter/red_exporter/beacon.py monitoring/exporter/tests/test_beacon.py
git commit -m "feat(red-exporter): beacon parsing + ingestion"
```

---

## Task 4: PostHog puller

**Files:**
- Create: `monitoring/exporter/red_exporter/posthog_pull.py`
- Create: `monitoring/exporter/tests/test_posthog_pull.py`

**Interfaces:**
- Produces: `posthog_pull.query_payload(settings, metric, window) -> dict` (HogQL query body); `posthog_pull.parse_vitals(resp_json) -> dict[str, dict]` (path → {lcp, inp, cls, fcp}); `posthog_pull.update_gauges(vitals) -> None`; `posthog_pull.pull_once(settings) -> None` (calls PostHog API via `requests`, handles errors → `metrics.POSTHOG_PULL_ERRORS.inc()`, records `metrics.POSTHOG_PULL_DURATION`).

- [ ] **Step 1: Write the failing test**

`monitoring/exporter/tests/test_posthog_pull.py`:
```python
from prometheus_client import REGISTRY, generate_latest
from red_exporter import posthog_pull, metrics

def _out():
    return generate_latest(REGISTRY).decode()

SAMPLE = {
    "results": [
        {"path": "/", "lcp": 1542, "inp": 78, "cls": 0.002, "fcp": 290}
    ]
}

def test_parse_vitals():
    v = posthog_pull.parse_vitals(SAMPLE)
    assert "/" in v
    assert v["/"]["lcp"] == 1542

def test_update_gauges_sets_values():
    posthog_pull.update_gauges({"/": {"lcp": 1.542, "inp": 0.078, "cls": 0.002, "fcp": 0.290}})
    out = _out()
    assert 'portfolio_lcp_seconds{path="/"} 1.542' in out
    assert 'portfolio_cls{path="/"} 0.002' in out

def test_pull_once_handles_error(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("network down")
    monkeypatch.setattr(posthog_pull, "_post_to_posthog", boom)
    before = _out().count("portfolio_posthog_pull_errors_total")
    posthog_pull.pull_once(posthog_pull._fake_settings())
    after = _out().count("portfolio_posthog_pull_errors_total")
    assert after == before + 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd monitoring/exporter && uv run pytest tests/test_posthog_pull.py -v`
Expected: FAIL — missing functions

- [ ] **Step 3: Write minimal implementation**

`monitoring/exporter/red_exporter/posthog_pull.py`:
```python
from __future__ import annotations
import time, requests
from . import metrics

# HogQL: web-vitals p75 per path over a window. Window token like "30m".
VITALS_QUERY = """
SELECT
  properties.$pathname AS path,
  quantile(0.75)(properties.$web_vitals_LCP_value / 1000.0) AS lcp,
  quantile(0.75)(properties.$web_vitals_INP_value / 1000.0) AS inp,
  quantile(0.75)(properties.$web_vitals_CLS_value) AS cls,
  quantile(0.75)(properties.$web_vitals_FCP_value / 1000.0) AS fcp
FROM events
WHERE event = '$web_vitals'
  AND timestamp > now() - INTERVAL {window:raw}
GROUP BY path
"""

def _fake_settings():
    from .config import Settings
    return Settings("k", "451732", "https://us.posthog.com", 15, "30m", "*", 9100)

def query_payload(settings, window: str) -> dict:
    return {"query": {"kind": "HogQLQuery", "query": VITALS_QUERY, "values": {"window": window}}}

def _post_to_posthog(settings, payload):
    url = f"{settings.posthog_host}/api/projects/{settings.posthog_project_id}/query"
    r = requests.post(url, json=payload, headers={"Authorization": f"Bearer {settings.posthog_api_key}"}, timeout=10)
    r.raise_for_status()
    return r.json()

def parse_vitals(resp_json: dict) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for row in resp_json.get("results", {}).get("results", []):
        # HogQL query endpoint returns nested results; tolerate both shapes
        path = row[0] if isinstance(row, list) else row.get("path")
        if not path:
            continue
        if isinstance(row, list):
            vals = {"lcp": row[1], "inp": row[2], "cls": row[3], "fcp": row[4]}
        else:
            vals = {"lcp": row.get("lcp"), "inp": row.get("inp"), "cls": row.get("cls"), "fcp": row.get("fcp")}
        out[path] = vals
    return out

def update_gauges(vitals: dict[str, dict]) -> None:
    for path, v in vitals.items():
        if v.get("lcp") is not None:
            metrics.LCP.labels(path=path).set(v["lcp"])
        if v.get("inp") is not None:
            metrics.INP.labels(path=path).set(v["inp"])
        if v.get("cls") is not None:
            metrics.CLS.labels(path=path).set(v["cls"])
        if v.get("fcp") is not None:
            metrics.FCP.labels(path=path).set(v["fcp"])

def pull_once(settings) -> None:
    start = time.time()
    try:
        payload = query_payload(settings, settings.posthog_pull_window)
        resp = _post_to_posthog(settings, payload)
        vitals = parse_vitals(resp)
        update_gauges(vitals)
    except Exception:
        metrics.POSTHOG_PULL_ERRORS.inc()
    finally:
        metrics.POSTHOG_PULL_DURATION.set(time.time() - start)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd monitoring/exporter && uv run pytest tests/test_posthog_pull.py -v`
Expected: PASS (note: `pull_once` uses `_fake_settings`; the test monkeypatches `_post_to_posthog` to raise → error counter increments)

- [ ] **Step 5: Commit**

```bash
git add monitoring/exporter/red_exporter/posthog_pull.py monitoring/exporter/tests/test_posthog_pull.py
git commit -m "feat(red-exporter): posthog web-vitals puller"
```

---

## Task 5: FastAPI app (routes + /metrics)

**Files:**
- Create: `monitoring/exporter/red_exporter/app.py`
- Create: `monitoring/exporter/tests/test_app.py`

**Interfaces:**
- Produces: `app.app` (FastAPI) with `POST /beacon`, `GET /healthz`, `GET /metrics`. Consumes `beacon.parse_beacon/ingest_event`, `metrics` registry, `config.get_settings`. Also `app.start_poller_thread(settings)` for the background PostHog poller.

- [ ] **Step 1: Write the failing test**

`monitoring/exporter/tests/test_app.py`:
```python
from fastapi.testclient import TestClient
from red_exporter import app as appmod

def test_healthz():
    c = TestClient(appmod.app)
    r = c.get("/healthz")
    assert r.status_code == 200

def test_beacon_accepts_pageview():
    c = TestClient(appmod.app)
    r = c.post("/beacon", content=b'{"type":"pageview","path":"/","locale":"ru","session_id":"s"}')
    assert r.status_code == 204

def test_beacon_bad_json_returns_400():
    c = TestClient(appmod.app)
    r = c.post("/beacon", content=b'not json')
    assert r.status_code == 400

def test_metrics_exposes_exposition():
    c = TestClient(appmod.app)
    r = c.get("/metrics")
    assert r.status_code == 200
    assert "portfolio_pageviews_total" in r.text
    assert "portfolio_lcp_seconds" in r.text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd monitoring/exporter && uv run pytest tests/test_app.py -v`
Expected: FAIL — `ModuleNotFoundError: red_exporter.app`

- [ ] **Step 3: Write minimal implementation**

`monitoring/exporter/red_exporter/app.py`:
```python
from __future__ import annotations
import threading, time
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from . import metrics, beacon, posthog_pull
from .config import get_settings

app = FastAPI(title="red-exporter")
settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.site_origin] if settings.site_origin != "*" else ["*"],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)

@app.get("/healthz")
def healthz():
    return {"ok": True}

@app.post("/beacon")
async def beacon_ep(request: Request):
    body = await request.body()
    try:
        events = beacon.parse_beacon(body)
    except ValueError:
        metrics.BEACON_FAILURES.labels(reason="parse").inc()
        return Response(status_code=400)
    for ev in events:
        beacon.ingest_event(ev)
    return Response(status_code=204)

@app.get("/metrics")
def metrics_ep():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

def start_poller_thread() -> threading.Thread:
    def loop():
        while True:
            posthog_pull.pull_once(settings)
            time.sleep(settings.posthog_pull_interval)
    t = threading.Thread(target=loop, daemon=True)
    t.start()
    return t
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd monitoring/exporter && uv run pytest tests/test_app.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add monitoring/exporter/red_exporter/app.py monitoring/exporter/tests/test_app.py
git commit -m "feat(red-exporter): FastAPI app (beacon/healthz/metrics + poller)"
```

---

## Task 6: Beacon client (site) + Astro component

**Files:**
- Create: `src/lib/beacon.ts`
- Create: `src/components/BeaconMetrics.astro`
- Create: `tests/lib/beacon.test.ts`
- Modify: site layout to include `<BeaconMetrics />` (find the base layout, e.g. `src/layouts/BaseLayout.astro` or similar — `grep -rl "<html" src/layouts | head`)

**Interfaces:**
- Produces: `beacon.ts` exports `buildBeacon(type, extra)`, `getSessionId()`. `BeaconMetrics.astro` renders an inline `<script>` that reads `import.meta.env.PUBLIC_BEACON_ENDPOINT` and fires beacons on load + `window.onerror` + `unhandledrejection`.

- [ ] **Step 1: Write the failing test**

`tests/lib/beacon.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { buildBeacon, getSessionId } from "../../src/lib/beacon";

describe("beacon", () => {
  beforeEach(() => sessionStorage.clear());

  it("builds a pageview payload", () => {
    const b = buildBeacon("pageview", { path: "/", locale: "ru" });
    expect(b.type).toBe("pageview");
    expect(b.path).toBe("/");
    expect(b.session_id).toBeTruthy();
    expect(typeof b.ts).toBe("number");
  });

  it("getSessionId is stable within a session", () => {
    const a = getSessionId();
    const b = getSessionId();
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/lib/beacon.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/beacon`

- [ ] **Step 3: Write minimal implementation**

`src/lib/beacon.ts`:
```typescript
const SESSION_KEY = "red_session_id";

export function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export interface BeaconEvent {
  type: "pageview" | "error";
  path: string;
  locale?: string;
  session_id: string;
  ts: number;
  error?: { type: string; message: string };
  [k: string]: unknown;
}

export function buildBeacon(type: "pageview" | "error", extra: Partial<BeaconEvent>): BeaconEvent {
  return {
    type,
    session_id: getSessionId(),
    ts: Date.now(),
    path: location.pathname,
    ...extra,
  } as BeaconEvent;
}

export function sendBeacon(endpoint: string, ev: BeaconEvent): void {
  try {
    navigator.sendBeacon(endpoint, JSON.stringify(ev));
  } catch {
    /* fail-silent */
  }
}
```

`src/components/BeaconMetrics.astro`:
```astro
---
const endpoint = import.meta.env.PUBLIC_BEACON_ENDPOINT as string | undefined;
---
{endpoint && (
  <script is:inline define:vars={{ endpoint }}>
    const k = "red_session_id";
    function sid(){ let i = sessionStorage.getItem(k); if(!i){ i = crypto.randomUUID(); sessionStorage.setItem(k,i);} return i; }
    function beacon(type, extra){
      try {
        navigator.sendBeacon(endpoint, JSON.stringify({ type, session_id: sid(), ts: Date.now(), path: location.pathname, locale: document.documentElement.lang || "ru", ...extra }));
      } catch(e){}
    }
    beacon("pageview", {});
    window.addEventListener("error", (e) => beacon("error", { error: { type: "Error", message: e.message }}));
    window.addEventListener("unhandledrejection", (e) => beacon("error", { error: { type: "PromiseRejection", message: String(e.reason) }}));
  </script>
)}
```

Then add `<BeaconMetrics />` into the base layout `<head>` (run `grep -rl "<html\\|<head" src/layouts` to find it; add the import + component near the closing `</head>`).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/lib/beacon.test.ts`
Expected: PASS

- [ ] **Step 5: Verify site still builds**

Run: `bun run build`
Expected: build succeeds; `dist/index.html` includes the beacon script when `PUBLIC_BEACON_ENDPOINT` is set.

- [ ] **Step 6: Commit**

```bash
git add src/lib/beacon.ts src/components/BeaconMetrics.astro tests/lib/beacon.test.ts <layout file>
git commit -m "feat(site): beacon metrics snippet for RED exporter"
```

---

## Task 7: Dockerfile + entrypoint

**Files:**
- Create: `monitoring/exporter/Dockerfile`
- Create: `monitoring/exporter/entrypoint.sh`

**Interfaces:**
- Produces: an image that runs `uvicorn red_exporter.app:app --host 0.0.0.0 --port 9100` (single process). The poller thread is started at import via `app.start_poller_thread()` guarded by env (so tests importing `app` don't start it — wrap in `if __name__`-style guard or an env flag `START_POLLER=1`).

- [ ] **Step 1: Guard poller start for tests**

Modify `monitoring/exporter/red_exporter/app.py` — add at bottom:
```python
import os
if os.environ.get("START_POLLER") == "1":
    start_poller_thread()
    metrics.EXPORTER_UP.set(1)
```

- [ ] **Step 2: Write Dockerfile**

`monitoring/exporter/Dockerfile`:
```dockerfile
FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir uvicorn[standard] fastapi prometheus-client requests
COPY red_exporter ./red_exporter
ENV START_POLLER=1
EXPOSE 9100
CMD ["uvicorn", "red_exporter.app:app", "--host", "0.0.0.0", "--port", "9100"]
```

`monitoring/exporter/entrypoint.sh` (optional if CMD suffices; kept for future hooks):
```bash
#!/bin/sh
set -e
exec uvicorn red_exporter.app:app --host 0.0.0.0 --port 9100
```

- [ ] **Step 3: Build image**

Run: `cd monitoring && docker build -f exporter/Dockerfile -t red-exporter:dev exporter/`
Expected: image builds.

- [ ] **Step 4: Smoke-run container**

Run: `docker run --rm -d -p 9100:9100 -e POSTHOG_API_KEY=dummy -e POSTHOG_PROJECT_ID=451732 red-exporter:dev && sleep 2 && curl -s localhost:9100/healthz && curl -s localhost:9100/metrics | head`
Expected: `/healthz` → `{"ok":true}`; `/metrics` lists `portfolio_*`.

- [ ] **Step 5: Commit**

```bash
git add monitoring/exporter/Dockerfile monitoring/exporter/entrypoint.sh monitoring/exporter/red_exporter/app.py
git commit -m "feat(red-exporter): dockerfile + poller guard"
```

---

## Task 8: docker-compose + prometheus.yml

**Files:**
- Create: `monitoring/docker-compose.yml`
- Create: `monitoring/prometheus/prometheus.yml`

**Interfaces:**
- Produces: a compose stack where `red-exporter` exposes port 9100 only within the docker network (NOT published to host), `prometheus` scrapes `red-exporter:9100/metrics` every 15s, `grafana` on host port 3000, `cloudflared` (configured in Task 10). `.env` loaded via `env_file`.

- [ ] **Step 1: Write prometheus.yml**

`monitoring/prometheus/prometheus.yml`:
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
scrape_configs:
  - job_name: red-exporter
    metrics_path: /metrics
    static_configs:
      - targets: ["red-exporter:9100"]
  - job_name: prometheus
    static_configs:
      - targets: ["localhost:9090"]
```

- [ ] **Step 2: Write docker-compose.yml**

`monitoring/docker-compose.yml`:
```yaml
services:
  red-exporter:
    build: ./exporter
    env_file: .env
    expose:
      - "9100"
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:v2.54.0
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"
    restart: unless-stopped
    depends_on:
      - red-exporter

  grafana:
    image: grafana/grafana:11.2.0
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
      - grafana-data:/var/lib/grafana
    ports:
      - "3000:3000"
    restart: unless-stopped
    depends_on:
      - prometheus

  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      - red-exporter
    restart: unless-stopped

volumes:
  prometheus-data:
  grafana-data:
```

- [ ] **Step 3: Bring up exporter + prometheus**

Run: `cd monitoring && cp .env.example .env && docker compose up -d red-exporter prometheus`
Expected: both healthy.

- [ ] **Step 4: Verify scrape works**

Run: `docker compose exec prometheus wget -qO- http://red-exporter:9100/metrics | grep portfolio_pageviews_total`
Expected: a metric line.

- [ ] **Step 5: Commit**

```bash
git add monitoring/docker-compose.yml monitoring/prometheus/prometheus.yml
git commit -m "feat(monitoring): docker-compose + prometheus scrape config"
```

---

## Task 9: Grafana provisioning + RED dashboard

**Files:**
- Create: `monitoring/grafana/provisioning/datasources/prometheus.yml`
- Create: `monitoring/grafana/provisioning/dashboards/red-dashboard.json`
- Create: `monitoring/grafana/provisioning/dashboards/dashboards.yml` (provider)

**Interfaces:**
- Produces: auto-provisioned Prometheus datasource + a RED dashboard with 3 panels (Rate, Errors, Duration) visible at `localhost:3000`.

- [ ] **Step 1: Write datasource provisioning**

`monitoring/grafana/provisioning/datasources/prometheus.yml`:
```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

`monitoring/grafana/provisioning/dashboards/dashboards.yml`:
```yaml
apiVersion: 1
providers:
  - name: RED
    folder: ""
    options:
      path: /etc/grafana/provisioning/dashboards
```

- [ ] **Step 2: Write RED dashboard JSON**

`monitoring/grafana/provisioning/dashboards/red-dashboard.json`:
```json
{
  "title": "RED — Portfolio",
  "schemaVersion": 39,
  "uid": "red-portfolio",
  "panels": [
    { "id": 1, "type": "stat", "title": "Rate (RPS)", "gridPos": {"x":0,"y":0,"w":8,"h":6},
      "targets": [{"expr": "sum(rate(portfolio_pageviews_total[1m]))", "refId": "A"}] },
    { "id": 2, "type": "timeseries", "title": "Rate — pageviews by path", "gridPos": {"x":8,"y":0,"w":16,"h":6},
      "targets": [{"expr": "sum by (path) (rate(portfolio_pageviews_total[5m]))", "refId": "A"}] },
    { "id": 3, "type": "stat", "title": "Error rate", "gridPos": {"x":0,"y":6,"w":8,"h":6},
      "targets": [{"expr": "sum(rate(portfolio_js_errors_total[5m])) / clamp_min(sum(rate(portfolio_pageviews_total[5m])), 1)", "refId": "A"}] },
    { "id": 4, "type": "timeseries", "title": "Errors by path", "gridPos": {"x":8,"y":6,"w":16,"h":6},
      "targets": [{"expr": "sum by (path) (rate(portfolio_js_errors_total[5m]))", "refId": "A"}] },
    { "id": 5, "type": "timeseries", "title": "Duration — LCP p75 by path", "gridPos": {"x":0,"y":12,"w":24,"h":8},
      "targets": [{"expr": "portfolio_lcp_seconds", "refId": "A"}] }
  ],
  "time": {"from": "now-1h", "to": "now"},
  "refresh": "15s"
}
```

- [ ] **Step 3: Bring up grafana + verify**

Run: `cd monitoring && docker compose up -d grafana && sleep 5 && curl -s http://localhost:3000/api/health`
Expected: `{"database":"ok",...}`; dashboard "RED — Portfolio" appears in Grafana UI.

- [ ] **Step 4: Commit**

```bash
git add monitoring/grafana/provisioning
git commit -m "feat(monitoring): grafana datasource + RED dashboard"
```

---

## Task 10: cloudflared config + Makefile + README

**Files:**
- Create: `monitoring/cloudflared/config.yml`
- Create: `monitoring/Makefile`
- Create: `monitoring/README.md`

**Interfaces:**
- Produces: cloudflared ingress filtering `/beacon`+`/healthz` → exporter, else 404; Make targets `monitor-up/down/logs/metrics`; README with one-time named-tunnel setup + PostHog personal API key + run instructions.

- [ ] **Step 1: Write cloudflared ingress config**

`monitoring/cloudflared/config.yml`:
```yaml
tunnel: ${CLOUDFLARE_TUNNEL_ID}
credentials-file: /etc/cloudflared/credentials.json
ingress:
  - hostname: ${BEACON_HOSTNAME}
    path: /beacon
    service: http://red-exporter:9100
  - hostname: ${BEACON_HOSTNAME}
    path: /healthz
    service: http://red-exporter:9100
  - service: http_status:404
```

- [ ] **Step 2: Write Makefile**

`monitoring/Makefile`:
```makefile
.PHONY: monitor-up monitor-down monitor-logs monitor-metrics monitor-ps

monitor-up:
\tdocker compose up -d

monitor-down:
\tdocker compose down

monitor-logs:
\tdocker compose logs -f red-exporter

monitor-metrics:
\tdocker compose exec -T red-exporter sh -c "curl -s localhost:9100/metrics | head -40"

monitor-ps:
\tdocker compose ps
```

- [ ] **Step 3: Write README**

`monitoring/README.md`:
```markdown
# RED-мониторинг портфолио (Prometheus)

Локальный стек: red-exporter (FastAPI) + Prometheus + Grafana + cloudflared tunnel.
Метрики RED (Rate, Errors, Duration) в exposition-формате, real-time.

## Prerequisites
- Docker + docker compose v2
- Cloudflare-аккаунт + домен на CF (для named tunnel)
- PostHog **personal API key** (Profile → API keys) — НЕ публичный project token

## One-time setup
1. `cp .env.example .env`; заполнить `POSTHOG_API_KEY`, `PUBLIC_BEACON_ENDPOINT`.
2. Named tunnel:
   `cloudflared tunnel login`
   `cloudflared tunnel create red-portfolio`
   `cloudflared tunnel route dns red-portfolio metrics.ваш-домен`
   Вписать `CLOUDFLARE_TUNNEL_TOKEN` (или `CLOUDFLARE_TUNNEL_ID` + credentials) в `.env`.
3. В корне портфолио `.env` добавить `PUBLIC_BEACON_ENDPOINT=https://metrics.ваш-домен/beacon`; `bun run build`.

## Запуск
`make monitor-up` → Prometheus :9090, Grafana :3000.
`make monitor-metrics` → exposition-строки.
`make monitor-down` → стоп.

## Security
Порт 9100 не published на хост. Публично через tunnel доступны только /beacon и
/healthz (cloudflared ingress path-filter). /metrics — только в docker-сети.
```

- [ ] **Step 4: Verify Makefile targets**

Run: `cd monitoring && make monitor-ps`
Expected: compose ps output (services listed or "no services" if down).

- [ ] **Step 5: Commit**

```bash
git add monitoring/cloudflared/config.yml monitoring/Makefile monitoring/README.md
git commit -m "feat(monitoring): cloudflared ingress + Makefile + README"
```

---

## Task 11: Integration smoke test

**Files:**
- Create: `monitoring/scripts/smoke.sh`

**Goal:** end-to-end: beacon → exporter → Prometheus → metric visible.

- [ ] **Step 1: Write smoke script**

`monitoring/scripts/smoke.sh`:
```bash
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
echo "== up =="
make monitor-up
sleep 5
echo "== beacon =="
docker compose exec -T red-exporter sh -c 'curl -s -X POST localhost:9100/beacon -d "{\"type\":\"pageview\",\"path\":\"/smoke\",\"locale\":\"ru\",\"session_id\":\"s1\"}"'
echo
echo "== exporter metric =="
make monitor-metrics | grep -E "portfolio_pageviews_total|portfolio_lcp_seconds"
echo "== prometheus query =="
docker compose exec -T prometheus wget -qO- 'http://localhost:9090/api/v1/query?query=portfolio_pageviews_total' | python3 -m json.tool | head -20
echo "== done =="
```

- [ ] **Step 2: Run smoke**

Run: `bash monitoring/scripts/smoke.sh`
Expected: beacon 204; metric lines present; Prometheus query returns a value > 0 for `/smoke`.

- [ ] **Step 3: Commit**

```bash
git add monitoring/scripts/smoke.sh
git commit -m "test(monitoring): end-to-end smoke script"
```

---

## Self-Review (run before handoff)

**Spec coverage:**
- §2 architecture (single exporter, two ingest paths) → Tasks 3–5. ✓
- §3.1 exporter (/beacon, /metrics, /healthz, poller, CORS) → Tasks 3,4,5. ✓
- §3.2 beacon snippet (Astro, fail-silent, sendBeacon, env) → Task 6. ✓
- §3.3 Prometheus scrape 15s → Task 8. ✓
- §3.4 Grafana provisioning + RED dashboard → Task 9. ✓
- §3.5 cloudflared named tunnel + path filter → Task 10. ✓
- §4 metrics catalog → Task 2 (all names/types match). ✓
- §5 beacon contract → Task 3 + 6. ✓
- §6 PostHog pull (personal key, error handling, duration gauge) → Task 4. ✓
- §7 layout → File Structure section. ✓
- §8 .env.example → Task 1. ✓
- §9 operation (Makefile, URLs, tunnel setup) → Task 10. ✓
- §10 error handling (parse→400+counter, pull error→counter+keep last, restart) → Tasks 3,4,8. ✓
- §11 testing (pytest + vitest + integration smoke) → Tasks 1–6, 11. ✓
- §13 prerequisites → README (Task 10). ✓
- §14 open Q (HogQL query) → prototyped in Task 4; verify against PostHog SQL editor during Task 4 execution. ✓

**Placeholder scan:** no TBD/TODO; HogQL query is concrete (may need column-name verification during execution — noted).

**Type consistency:** `Settings` fields used in Task 4/5 match Task 1. Metric names match Task 2 throughout. `parse_beacon`/`ingest_event` signatures consistent Task 3↔5. `pull_once(settings)` consistent Task 4↔5.
