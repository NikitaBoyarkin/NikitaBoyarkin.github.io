#!/usr/bin/env bash
# Cutover from the Bun exporter to the Rust one. Every step is yours to run; this script only
# walks you through them, checks what a command can check, and offers the way back.
#
#   bash rust/cutover.sh          # from monitoring/exporter
#
# Nothing here is irreversible: the Bun image stays built, `docker-compose.yml` is edited in one
# line, and step 6 puts it back.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
COMPOSE="$ROOT/docker-compose.yml"
BACKUP="$ROOT/docker-compose.yml.bun-backup"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ask() { read -r -p "$* [Enter to continue, Ctrl-C to stop] " _; }

wait_healthy() {
  for _ in $(seq 1 60); do
    if docker compose exec -T red-exporter sh -c 'wget -qO- localhost:9100/healthz' 2>/dev/null | grep -q ok; then
      return 0
    fi
    sleep 1
  done
  return 1
}

say "1/6 · Replay the Rust build against the recorded cases"
rust-anything app replay . --build 'sh -c "START_POLLER=1 POSTHOG_PULL_INTERVAL=3600 \
  BEACON_DB=$PWD/rust/.tmp/beacon.sqlite BEACON_PORT=$PORT exec ./rust/app/target/release/index"'
ask "The run above must say 46/46 with fallback 0%."

say "2/6 · Build the Rust image"
docker build -f Dockerfile.rust -t red-exporter:rust .
docker images red-exporter:rust --format '{{.Repository}}:{{.Tag}} {{.Size}}'
ask "About 29 MB is expected (the Bun image is ~174 MB)."

say "3/6 · Prove the image answers, outside compose"
docker rm -f red-exporter-probe >/dev/null 2>&1 || true
docker run -d --rm --name red-exporter-probe -e BEACON_PORT=9100 -e START_POLLER=0 -p 9611:9100 red-exporter:rust >/dev/null
sleep 2
curl -s -o /dev/null -w 'healthz %{http_code}\n' localhost:9611/healthz
curl -s -o /dev/null -w 'beacon  %{http_code}\n' -X POST localhost:9611/beacon \
  -d '{"type":"pageview","path":"/cutover","locale":"ru"}'
curl -s localhost:9611/metrics | grep -F 'path="/cutover"'
docker stop red-exporter-probe >/dev/null
ask "Three lines, the last one a pageview sample for /cutover."

say "4/6 · Switch compose to the Rust image"
cp "$COMPOSE" "$BACKUP"
python3 - "$COMPOSE" <<'PY'
import sys
path = sys.argv[1]
text = open(path).read()
old = "    build: ./exporter\n"
new = "    build:\n      context: ./exporter\n      dockerfile: Dockerfile.rust\n"
if new not in text:
    assert old in text, "compose layout changed: the red-exporter build stanza is not the expected one"
    text = text.replace(old, new, 1)
    open(path, "w").write(text)
print(open(path).read().split("services:")[1].split("prometheus:")[0])
PY
ask "The red-exporter service now builds Dockerfile.rust. Backup at docker-compose.yml.bun-backup."

say "5/6 · Up, and check the RED frame"
docker compose up -d --build red-exporter
wait_healthy || { echo "healthz did not answer — see step 6"; exit 1; }
curl -s -X POST localhost:9100/beacon -d '{"type":"pageview","path":"/cutover","locale":"ru"}' >/dev/null 2>&1 || true
docker compose exec -T red-exporter sh -c 'wget -qO- localhost:9100/metrics' | head -20
ask "Check Prometheus: a query for portfolio_pageviews_total should now show path=\"/cutover\"."

say "6/6 · Rollback (only if something is wrong)"
cat <<EOF
    cp "$BACKUP" "$COMPOSE"
    docker compose up -d --build red-exporter

The Bun image and \`Dockerfile\` are untouched, so the way back is one file and one rebuild.
EOF

say "Done. Nothing else is running: the tunnel, Prometheus and Grafana are unchanged."
