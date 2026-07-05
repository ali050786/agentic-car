# Deploying the background worker (Coolify)

The worker (`worker/`) is a small persistent Node service that runs the
carousel create/edit pipeline as a background job — it needs to keep running
even after the browser tab closes, which stateless Vercel functions can't do.
This doc covers getting it running for free on a self-hosted Coolify instance.

## 1. Get a free server

Coolify is free and open-source, but it needs a machine to run on. The
genuinely $0/month option is **Oracle Cloud's "Always Free" tier**:

1. Create an Oracle Cloud account at oracle.com/cloud/free.
2. Create a Compute instance using the **Ampere A1 (ARM)** shape — the free
   tier includes up to 4 OCPUs / 24GB RAM, far more than this needs.
   Ubuntu 22.04 is a safe image choice.
3. Open port **4000** (or whatever `WORKER_PORT` you choose) and **8000**
   (Coolify's default UI port) in the instance's security list / network
   security group, alongside the usual 22 (SSH), 80, 443.
4. If Oracle's free tier isn't available in your account/region, a small paid
   VPS (e.g. Hetzner CX22, ~€4.50/mo) is the fallback — the rest of these
   steps are identical.

## 2. Install Coolify

SSH into the server and run Coolify's official installer:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Follow the prompts, then open `http://<server-ip>:8000` to finish setup
(create your admin account).

## 3. One-time Appwrite setup

Before deploying, create the collection this feature needs and a privileged
API key, from your own machine (not the server):

```bash
# .env (or exported inline) needs APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID,
# APPWRITE_API_KEY, APPWRITE_DATABASE_ID — see .env.example
npx tsx scripts/setupGenerationJobsCollection.ts
```

To get `APPWRITE_API_KEY`: Appwrite Console → your project → Settings →
API Keys → Create API Key. On the key's Scopes screen, enable **every**
checkbox under **Databases**, **Users**, and **Storage** — not just
`databases.read`/`databases.write`, which only covers reading/writing
documents. Creating the `generation_jobs` collection (and its attributes and
indexes) needs the `collections.*`, `attributes.*`, and `indexes.*` scopes
too, which Appwrite groups separately from plain document access. If the
setup script fails with `missing scopes (["collections.read"])` or similar,
this is why — go back and enable the rest of the Databases checkboxes.

This key is deliberately **not** the same as `VITE_APPWRITE_API_KEY` in
`.env.example` (that one is unused and incorrectly VITE_-prefixed — never
give it real scopes, since a `VITE_` prefix means Vite would ship it in the
browser bundle).

## 4. Deploy the worker on Coolify

In the Coolify dashboard:

1. **New Resource → Application → Public/Private Git Repository**, point it
   at this repo.
2. **Build Pack**: Dockerfile.
3. **Dockerfile location**: `Dockerfile.worker` (repo root — not inside
   `worker/`, since the image needs the whole repo: `core/`, `services/`,
   `utils/`, `config/`, `lib/`, `types.ts` are all imported by the job
   handlers, not just files under `worker/`).
4. **Build context**: repo root (Coolify's default).
5. **Port**: 4000 (or your `WORKER_PORT`).
6. **Environment variables** — set all of these (see `.env.example` for the
   full list with descriptions):
   - `GROQ_API_KEY`, `CLAUDE_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`
   - `TAVILY_API_KEY`, `REPLICATE_API_TOKEN`
   - `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`,
     `APPWRITE_DATABASE_ID`, `APPWRITE_CAROUSELS_COLLECTION_ID`,
     `APPWRITE_ANALYTICS_COLLECTION_ID`, `APPWRITE_PROFILES_COLLECTION_ID`,
     `APPWRITE_STORAGE_BUCKET_ID`
   - `WORKER_PORT=4000`
   - `APP_ORIGIN` — your deployed frontend's origin (e.g.
     `https://your-app.vercel.app`), so the worker's CORS only accepts
     requests from your app, not arbitrary sites.
7. Deploy. Coolify will build the image and keep the container running,
   restarting it automatically if it crashes (this is also what makes the
   `resumeOnBoot()` logic in `worker/queue.ts` matter — a restart re-queues
   anything left `queued` and fails anything stuck `running` past 10 minutes).
8. Optionally attach a domain in Coolify (or use the auto-generated one) and
   enable HTTPS — Coolify provisions Let's Encrypt certs automatically.

## 5. Point the frontend at it

In your frontend's deployment (Vercel project settings → Environment
Variables), set:

```
VITE_WORKER_URL=https://your-worker-domain
```

Redeploy the frontend. `services/jobService.ts` reads this to know where to
POST new jobs.

Also add `https://your-worker-domain` and `wss://sgp.cloud.appwrite.io` (your
Appwrite region) to the `connect-src` directive in `index.html`'s CSP meta
tag — the browser blocks both the job POST and the Realtime subscription
otherwise (silently, as a CSP violation rather than an error your code can
catch).

## 6. Local development

Run the worker alongside the normal dev server:

```bash
npm run dev      # frontend, as usual
npm run worker   # tsx watch worker/index.ts
```

Set `VITE_WORKER_URL=http://localhost:4000` and `APP_ORIGIN=http://localhost:3000`
in your local `.env`. The worker uses the same Appwrite project as the
frontend (Appwrite Cloud), so there's nothing else to run locally — no local
database needed.
