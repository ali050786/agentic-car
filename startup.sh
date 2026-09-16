#!/usr/bin/env bash
# Frees ports 3000 (frontend) and 4000 (background worker), then runs both
# `npm run dev` and `npm run worker` together. Ctrl+C stops both.
set -euo pipefail

# --- Ensure a Node version that works with node-appwrite@14 ---
# node-appwrite@14 ships fetch via node-fetch-native-with-agent, whose bundled
# undici crashes on Node >= 25 with UND_ERR_INVALID_ARG ("invalid onError
# method") the moment the worker makes its first Appwrite call. If the default
# `node` is too new, fall back to an installed LTS (<= 24, matching the Node 20
# used by Dockerfile.worker in production).
node_major() { local v; v=$("$1" -v 2>/dev/null || echo v0); v=${v#v}; echo "${v%%.*}"; }
CUR_MAJOR=$(node_major node)
if [ "${CUR_MAJOR:-0}" -gt 24 ]; then
  PICKED=""
  for cand in /usr/local/bin/node /opt/homebrew/bin/node "$HOME/.local/bin/node"; do
    [ -x "$cand" ] || continue
    m=$(node_major "$cand")
    if [ "${m:-0}" -ge 1 ] && [ "${m:-0}" -le 24 ]; then PICKED="$cand"; break; fi
  done
  if [ -n "$PICKED" ]; then
    PATH="$(dirname "$PICKED"):$PATH"; export PATH
    echo "startup.sh: default node is v$CUR_MAJOR (crashes node-appwrite@14); using $("$PICKED" -v) from $(dirname "$PICKED")"
  else
    echo "startup.sh: ERROR — node v$CUR_MAJOR is too new for node-appwrite@14 and no Node <= 24 was found on PATH." >&2
    echo "  Install/select Node 20-24 (an LTS) and re-run, or upgrade node-appwrite." >&2
    exit 1
  fi
fi
# -------------------------------------------------------------

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
