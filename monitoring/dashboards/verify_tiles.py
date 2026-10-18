#!/usr/bin/env python3
"""Verify every DASHBOARDS_V2 tile query returns data (read-only)."""

import importlib.util
import json
import os
import sys
import time
import urllib.error
import urllib.request

spec = importlib.util.spec_from_file_location("cd", "create_dashboards.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

KEY = os.environ["POSTHOG_API_KEY"]
HOST = os.environ.get("POSTHOG_HOST", "https://us.posthog.com")
HOST = (
    HOST.replace(".i.posthog.com", ".posthog.com")
    .replace("://i.posthog.com", "://posthog.com")
    .rstrip("/")
)
BASE = f"{HOST}/api/projects/{os.environ.get('POSTHOG_PROJECT_ID', '451732')}"


def rows_for(query, attempts: int = 4):
    """Row count for one query. The API drops connections intermittently, so a
    failure is retried rather than reported as an empty tile."""
    last = None
    for _ in range(attempts):
        try:
            req = urllib.request.Request(
                f"{BASE}/query/",
                data=json.dumps({"query": query}).encode(),
                headers={
                    "Authorization": f"Bearer {KEY}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.loads(r.read().decode())
            results = data.get("results")
            if results is None:
                results = data.get("data", data)
            if isinstance(results, list):
                return len(results)
            return 1 if results else 0
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2)
    raise last


empty, failed = [], []
for dash in m.DASHBOARDS_V2:
    print(f"\n== {dash['name']}")
    for t in dash["tiles"]:
        try:
            n = rows_for(t["query"])
            flag = "EMPTY" if n == 0 else "ok"
            if n == 0:
                empty.append((dash["name"], t["name"]))
            print(f"  {flag:<5} rows={n:<4} {t['name']}")
        except urllib.error.HTTPError as e:
            failed.append(
                (dash["name"], t["name"], f"{e.code} {e.read().decode()[:200]}")
            )
            print(f"  FAIL  {t['name']}: {e.code} {e.read().decode()[:200]}")
        except Exception as e:  # noqa: BLE001
            failed.append((dash["name"], t["name"], str(e)))
            print(f"  ERR   {t['name']}: {e}")

print(f"\nempty tiles: {len(empty)}  failed tiles: {len(failed)}")
for d, t in empty:
    print(f"  EMPTY: {d} :: {t}")
for d, t, err in failed:
    print(f"  FAILED: {d} :: {t} :: {err}")
sys.exit(1 if failed else 0)
