# Vercel Deployment Guide

This guide covers deploying the frontend application and client-facing serverless API endpoints to Vercel.

## 1. Environment Variables

Configure these environment variables in your Vercel project dashboard (**Settings** → **Environment Variables**):

```bash
# AI Model Keys (used by the /api proxy endpoints)
CLAUDE_API_KEY=your_claude_key_here
OPENROUTER_API_KEY=your_openrouter_key_here

# Appwrite Configurations
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your_project_id_here
VITE_APPWRITE_DATABASE_ID=main
VITE_APPWRITE_CAROUSELS_COLLECTION_ID=carousels
VITE_APPWRITE_ANALYTICS_COLLECTION_ID=user_analytics
VITE_APPWRITE_PROFILES_COLLECTION_ID=profiles

# Background Worker URL (Coolify or local daemon url)
VITE_WORKER_URL=https://your-worker-domain.com
```

---

## 2. Deployment Options

### Option 1: GitHub Integration (Recommended)
1. Connect your repository to Vercel.
2. Vercel automatically deploys your project on every push to the `main` branch.

### Option 2: Vercel CLI
```bash
npm install -g vercel
vercel deploy --prod
```

---

## 3. How It Works in Production

*   **Static Assets**: Vite compiles the React SPA and hosts it globally.
*   **Serverless API Proxy**: The `/api` directory houses serverless API handlers (e.g., `/api/generate.ts`, `/api/scrape.ts`, `/api/youtube-transcript.ts`) that execute short-lived server-side requests (such as proxying scraping requests or initiating quick AI queries).
*   **Background Tasks**: Asynchronous long-running requests (generation of a full carousel deck) are POSTed to the URL defined by `VITE_WORKER_URL`, routing to the persistent background worker queue.
