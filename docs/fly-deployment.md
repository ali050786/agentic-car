# Deploying the background worker on Fly.io

Moves `worker/` off the DigitalOcean droplet (Docker + Caddy) onto a single
always-on Fly Machine. Fly handles HTTPS, restarts, and health checks, so
Caddy, swap setup, and SSH are no longer needed.

- **App:** `agentic-car-worker` (config in `fly.toml`)
- **Region:** `sin` (Singapore), same as Appwrite `sgp.cloud.appwrite.io`
- **Machine:** shared-cpu-1x, 1 GB RAM + 1 GB swap, exactly 1 machine
- **URL:** `https://agentic-car-worker.fly.dev`, then `https://worker.blinkwiser.com` after cutover
- **Frontend:** Vercel (`https://carousel.blinkwiser.com`), unchanged

## Why one machine

The job queue is in-process (`worker/queue.ts`). With two machines, both would
run `resumeOnBoot()` and could pick up the same queued job. So: `--ha=false`,
`auto_stop_machines = "off"`, `min_machines_running = 1`. Scale up (bigger VM)
rather than out until the queue moves to something shared.

## 1. First deploy

From the repo root on your Mac:

```bash
bash scripts/fly-setup.sh
```

It installs flyctl if missing, runs `fly auth login` (approve in the browser),
creates the app, imports the server-side keys from `.env` as Fly secrets
(values are never printed), sets `APP_ORIGIN=https://carousel.blinkwiser.com`,
deploys one machine, and hits `/health`.

`fly deploy` ships your **working tree**, not the last commit. Commit first if
you want the deploy to match `main`.

Non-secret config (`NODE_ENV`, `WORKER_PORT`, `PIPELINE_VERSION`) lives in the
`[env]` block of `fly.toml`.

## 2. Check it

```bash
fly status
fly logs                       # expect "Background worker running" and "[queue] Resuming N queued job(s)"
curl https://agentic-car-worker.fly.dev/health   # {"status":"ok"}
```

## 3. Cut over worker.blinkwiser.com (no Vercel change needed)

The frontend already calls `https://worker.blinkwiser.com`, so pointing that
name at Fly switches traffic without a client redeploy.

```bash
fly certs add worker.blinkwiser.com
```

In GoDaddy DNS for `blinkwiser.com`:

| Action | Type | Name | Value |
|---|---|---|---|
| Delete | A | `worker` | `168.144.184.25` (the droplet) |
| Add | CNAME | `worker` | `agentic-car-worker.fly.dev` |

Then wait for the cert:

```bash
dig +short worker.blinkwiser.com      # should resolve via agentic-car-worker.fly.dev
fly certs check worker.blinkwiser.com # wait for "Issued"
curl https://worker.blinkwiser.com/health
```

Create one carousel and one edit from `carousel.blinkwiser.com` to confirm.

## 4. Retire the droplet

Once the Fly worker has handled a real job, stop the old one so two workers
never share the Appwrite jobs collection:

```bash
ssh root@168.144.184.25
cd agentic-car && docker compose down
```

Destroy the droplet in DigitalOcean when you are happy.

## Day to day

```bash
fly deploy                     # redeploy after changes
fly logs                       # tail logs
fly secrets set KEY=value      # add/rotate a secret (restarts the machine)
fly secrets list               # names only
fly ssh console                # shell inside the machine
fly scale memory 2048          # if you see OOM kills in the logs
```

A deploy restarts the machine. A job running at that moment is marked
"Worker restarted mid-job, please retry" by the staleness watcher, so avoid
deploying while someone is generating.

## Rollback

```bash
fly releases --image           # find the last good image
fly deploy --image <image-from-that-release>
```

Or point the `worker` DNS record back at `168.144.184.25` if the droplet is
still up.
