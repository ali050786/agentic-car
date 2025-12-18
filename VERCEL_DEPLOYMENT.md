# Vercel Deployment Guide

## Environment Variables

Set these in your Vercel project dashboard (Settings → Environment Variables):

```bash
OPENROUTER_API_KEY=your_openrouter_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
```

## Deployment

### Option 1: Vercel CLI
```bash
npm install -g vercel
vercel deploy
```

### Option 2: GitHub Integration
Connect your repository to Vercel for automatic deployments on push.

## How It Works

- **Development**: Vite proxy middleware handles `/api/generate`
- **Production**: Vercel serverless function (`/api/generate.ts`) handles requests
- Both use identical logic for BYOK and free tier authentication
