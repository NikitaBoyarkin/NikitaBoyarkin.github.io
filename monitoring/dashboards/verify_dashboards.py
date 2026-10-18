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
    """Returns (row_count, volume) — volume = captured events, or None."""
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
            if not isinstance(results, list):
                return (1 if results else 0), None
            return len(results), volume_of(results)
        except Exception as e:  # noqa: BLE001 — the API drops connections intermittently
            last = e
    raise last


# A tile whose underlying events number fewer than this in the window is "expected
# to be empty": at the site's traffic (5-27 unique visitors a week) a sub-1%-per-visit
# action yields 0-2 rows a quarter. See docs/analytics-dead-events.md.
VOLUME_FLOOR = 10


def volume_of(results):
    """Captured-event volume behind a result set, or None when not derivable.

    Trends return one dict per series (`aggregated_value`, or a `data` array of
    per-interval counts); funnels return one dict per step (`count`). HogQL
    tables return rows, which are *not* a volume — None keeps the rule from
    firing on them.
    """
    if not results or not isinstance(results[0], dict):
        return None
    total, saw_any = 0, False
    for row in results:
        for key in ("aggregated_value", "count"):
            value = row.get(key)
            if isinstance(value, (int, float)):
                total += value
                saw_any = True
        series = row.get("data")
        if isinstance(series, list) and all(
            isinstance(x, (int, float)) for x in series
        ):
            total += sum(series)
            saw_any = True
    return total if saw_any else None


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

total_tiles, empty, broken, low_volume = 0, [], [], []
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
            n, vol = run_query(q)
            flag = "EMPTY" if n == 0 else "ok"
            note = ""
            if vol is not None and vol < VOLUME_FLOOR:
                flag = "THIN" if n else "EMPTY"
                note = f" [volume={int(vol)} < floor {VOLUME_FLOOR}]"
                low_volume.append((name, ins.get("name"), int(vol)))
            print(f"   {flag:<5} rows={n:<4} {ins.get('name')}{note}")
            if n == 0:
                empty.append((name, ins.get("name")))
        except urllib.error.HTTPError as e:
            body = e.read().decode()[:180]
            broken.append((name, ins.get("name"), f"{e.code} {body}"))
            print(f"   FAIL  {ins.get('name')}: {e.code} {body}")
        except Exception as e:  # noqa: BLE001
            broken.append((name, ins.get("name"), str(e)))
            print(f"   ERR   {ins.get('name')}: {e}")

print(
    f"\ntiles checked: {total_tiles}  empty: {len(empty)}  "
    f"below volume floor: {len(low_volume)}  broken: {len(broken)}"
)
for d, t in empty:
    print(f"  EMPTY: {d} :: {t}")
for d, t, v in low_volume:
    print(f"  THIN (volume={v}): {d} :: {t}")
for d, t, err in broken:
    print(f"  BROKEN: {d} :: {t} :: {err}")
sys.exit(1 if broken or missing else 0)
