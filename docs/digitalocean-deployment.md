# Deploying the background worker (DigitalOcean + Docker + Caddy)

Runs `worker/` as a persistent Docker container behind Caddy (automatic HTTPS)
on a DigitalOcean droplet. No Coolify — Docker Compose keeps the container
alive and Caddy handles TLS, which is all Coolify was doing for us.

- **Droplet:** Ubuntu 24.04, `168.144.184.25` (BLR1)
- **Worker domain:** `https://worker.blinkwiser.com`
- **Frontend:** Vercel (`https://carousel.blinkwiser.com`) — calls the worker from the browser, so the worker MUST be HTTPS on a real domain.

The worker's server code reads `APPWRITE_*` env vars but falls back to your
existing `VITE_APPWRITE_*` values, so your local `.env` works on the server
almost unchanged — only `APP_ORIGIN` needs to be the production frontend origin.

---

## Step 0 — DNS (do this first, it needs time to propagate)

Wherever you manage `blinkwiser.com` DNS, add:

| Type | Name     | Value            | Proxy       | TTL |
|------|----------|------------------|-------------|-----|
| A    | `worker` | `168.144.184.25` | DNS only    | Auto / 300 |

> **Cloudflare users:** set the record to **DNS only** (grey cloud), not
> Proxied (orange). Caddy needs to complete the Let's Encrypt challenge
> directly; the proxy interferes with first-time cert issuance. You can switch
> it to Proxied later if you want.

Verify from your Mac before continuing:

```bash
dig +short worker.blinkwiser.com   # should print 168.144.184.25
```

## Step 1 — Open a shell on the droplet

DigitalOcean → your droplet → **Web Console** (top right). This drops you into
a root shell in the browser — no SSH key needed.

## Step 2 — Add swap (important on a 1 GB box)

The Docker build (`npm ci` over a large dependency tree) and the worker's
image/LLM work can spike memory past 1 GB and get OOM-killed. A 2 GB swap file
prevents that:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
free -h   # confirm the Swap line now shows 2.0Gi
```

## Step 3 — Install Docker + git

```bash
apt-get update && apt-get install -y git
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version   # both should print versions
```

## Step 4 — Firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Port 4000 stays closed — only Caddy (80/443) is public; it reaches the worker
over Docker's internal network.

## Step 5 — Get the code

```bash
cd /opt
git clone https://github.com/ali050786/agentic-car.git
cd agentic-car
```

## Step 6 — Add the Compose + Caddy files

If they aren't already committed to the repo, create them in the project root:

```bash
cat > docker-compose.yml <<'EOF'
services:
  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    env_file: .env
    environment:
      NODE_ENV: production
    expose:
      - "4000"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 60s
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - worker
volumes:
  caddy_data:
  caddy_config:
EOF

cat > Caddyfile <<'EOF'
worker.blinkwiser.com {
	reverse_proxy worker:4000
}
EOF
```

## Step 7 — Create `.env` (the secrets)

Copy your **local** `.env` contents into a `.env` on the server:

```bash
nano .env
```

Paste everything, then change one line before saving:

```
APP_ORIGIN=https://carousel.blinkwiser.com
```

`APP_ORIGIN` is the worker's CORS allow-list — it must be the exact origin your
frontend is served from. Save with `Ctrl+O`, `Enter`, exit with `Ctrl+X`.

> The `.env` is git-ignored and never baked into the image (`.dockerignore`
> excludes it); Compose injects it at runtime via `env_file`.

## Step 8 — Launch

```bash
docker compose up -d --build
docker compose logs -f worker   # watch for: 🧵 Background worker running on http://localhost:4000
```

First build takes a few minutes. `Ctrl+C` stops following logs (containers keep
running).

## Step 9 — Verify HTTPS

Caddy issues the cert automatically once DNS resolves. From your Mac:

```bash
curl https://worker.blinkwiser.com/health   # {"status":"ok"}
```

If the cert isn't ready yet, check `docker compose logs caddy` — the usual
cause is DNS not yet pointing at the droplet (Step 0).

## Step 10 — Point the frontend at the worker

Vercel → project → Settings → Environment Variables:

```
VITE_WORKER_URL = https://worker.blinkwiser.com
```

Redeploy the frontend. (`index.html`'s CSP already whitelists this domain, so
no code change is needed.) Then create a carousel on the live site and confirm
the job runs — `docker compose logs -f worker` should show it come in.

---

## Day-2 operations

```bash
cd /opt/agentic-car
docker compose logs -f worker      # tail logs
docker compose restart worker      # restart just the worker
docker compose down                # stop everything
git pull && docker compose up -d --build   # deploy latest code
```

Both containers `restart: unless-stopped`, so they survive reboots and crashes.
On restart the worker re-queues anything left `queued` and fails jobs stuck
`running` past 10 min (see `worker/queue.ts`).
