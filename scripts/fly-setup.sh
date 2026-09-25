#!/usr/bin/env bash
# One-time Fly.io setup + first deploy for the background worker.
# Run from the repo root on your Mac:  bash scripts/fly-setup.sh
# Safe to re-run: it skips steps that are already done.
# Secret values go straight from .env into Fly and are never printed.
set -euo pipefail

APP="agentic-car-worker"
FRONTEND_ORIGIN="https://carousel.blinkwiser.com"

cd "$(dirname "$0")/.."

# 1. flyctl
if ! command -v fly >/dev/null 2>&1; then
  echo "Installing flyctl..."
  if command -v brew >/dev/null 2>&1; then brew install flyctl
  else curl -L https://fly.io/install.sh | sh; export PATH="$HOME/.fly/bin:$PATH"; fi
fi
fly version

# 2. Login (opens the browser for you to approve)
fly auth whoami >/dev/null 2>&1 || fly auth login
echo "Logged in as: $(fly auth whoami)"

# 3. App (name comes from fly.toml)
if fly status --app "$APP" >/dev/null 2>&1; then
  echo "App $APP already exists."
else
  fly apps create "$APP"
fi

# 4. Secrets: server-side keys only, straight from .env. --stage = no deploy yet.
[ -f .env ] || { echo "No .env in repo root; aborting." >&2; exit 1; }
grep -E '^(APPWRITE_[A-Z_]+|VITE_APPWRITE_[A-Z_]+|CLAUDE_API_KEY|GROQ_API_KEY|OPENROUTER_API_KEY|REPLICATE_API_TOKEN|TAVILY_API_KEY|VITE_TAVILY_API_KEY|LANGFUSE_[A-Z_]+)=' .env \
  | fly secrets import --app "$APP" --stage
fly secrets set --app "$APP" --stage APP_ORIGIN="$FRONTEND_ORIGIN"
echo "Secret names now on Fly:"; fly secrets list --app "$APP"

# 5. Deploy: exactly one machine (the job queue is in-process)
fly deploy --app "$APP" --ha=false

# 6. Check
fly status --app "$APP"
echo "Health check:"; curl -fsS "https://$APP.fly.dev/health" && echo
echo "Done. Next: DNS cutover in docs/fly-deployment.md (step 3)."
