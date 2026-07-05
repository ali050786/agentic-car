#!/usr/bin/env bash
# Frees ports 3000 (frontend) and 4000 (background worker), then runs both
# `npm run dev` and `npm run worker` together. Ctrl+C stops both.
set -euo pipefail

for PORT in 3000 4000; do
  PIDS=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "Killing process(es) on port $PORT: $PIDS"
    kill -9 $PIDS 2>/dev/null || true
  fi
done

cleanup() {
  echo "Stopping dev server and worker..."
  kill 0
}
trap cleanup EXIT INT TERM

npm run dev &
npm run worker &

wait
