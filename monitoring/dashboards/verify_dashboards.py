#!/usr/bin/env python3
"""Verify the created v2 dashboards: tiles exist, and each stored query returns data."""

import importlib.util
import json
import os
import sys
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


def get(url):
    req = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {KEY}", "Accept": "application/json"}
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


def run_query(query, attempts: int = 3):
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
            return len(results) if isinstance(results, list) else (1 if results else 0)
        except Exception as e:  # noqa: BLE001 — the API drops connections intermittently
            last = e
    raise last


wanted = {d["name"] for d in m.DASHBOARDS_V2}
found = {}
url = f"{BASE}/dashboards/?limit=100"
while url:
    page = get(url)
    for d in page["results"]:
        if d["name"] in wanted:
            found[d["name"]] = d["id"]
    url = page.get("next")

missing = wanted - set(found)
print(f"dashboards found: {len(found)}/{len(wanted)}")
if missing:
    print("MISSING:", missing)

total_tiles, empty, broken = 0, [], []
for name, did in sorted(found.items(), key=lambda kv: kv[1]):
    dash = get(f"{BASE}/dashboards/{did}/")
    tiles = [t for t in (dash.get("tiles") or []) if t.get("insight")]
    print(
        f"\n== {name}  id={did}  url={HOST}/project/{BASE.rsplit('/', 1)[-1]}/dashboard/{did}  tiles={len(tiles)}"
    )
    for t in tiles:
        ins = t["insight"]
        total_tiles += 1
        q = ins.get("query")
        try:
            n = run_query(q)
            print(f"   {'EMPTY' if n == 0 else 'ok':<5} rows={n:<4} {ins.get('name')}")
            if n == 0:
                empty.append((name, ins.get("name")))
        except urllib.error.HTTPError as e:
            body = e.read().decode()[:180]
            broken.append((name, ins.get("name"), f"{e.code} {body}"))
            print(f"   FAIL  {ins.get('name')}: {e.code} {body}")
        except Exception as e:  # noqa: BLE001
            broken.append((name, ins.get("name"), str(e)))
            print(f"   ERR   {ins.get('name')}: {e}")

print(f"\ntiles checked: {total_tiles}  empty: {len(empty)}  broken: {len(broken)}")
for d, t in empty:
    print(f"  EMPTY: {d} :: {t}")
for d, t, err in broken:
    print(f"  BROKEN: {d} :: {t} :: {err}")
sys.exit(1 if broken or missing else 0)
