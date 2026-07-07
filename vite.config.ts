import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import dotenv from 'dotenv';
import react from '@vitejs/plugin-react';
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { ChatGroq } from '@langchain/groq';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { YoutubeTranscript } from 'youtube-transcript';
import { FREE_TIER_LIMIT, MAX_SOURCE_CONTENT_CHARS } from './config/constants';
import { htmlToReadableText, extractTitle } from './utils/htmlToText';
import { generateContent } from './core/llm/generateContent';
import dns from 'dns';
if (dns && typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}
dotenv.config();

/**
 * AI Model Proxy Plugin for Vite Development Server
 * 
 * ⚠️ IMPORTANT: This plugin ONLY works during local development (npm run dev)
 * 
 * For production deployment on Vercel, the `/api/generate.ts` serverless function
 * handles all AI proxy requests. This plugin is ignored in production builds.
 * 
 * Both implementations share the same logic:
 * - Hybrid authentication (BYOK + free tier)
 * - Multi-provider support (OpenRouter, OpenAI, Anthropic)
 * - Free tier usage limits (10 generations)
 */
const aiModelProxyPlugin = (env: Record<string, string>) => ({
  name: 'ai-model-proxy',
  configureServer(server: any) {
    server.middlewares.use('/api/generate', async (req: any, res: any) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        return res.end('Method Not Allowed');
      }
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyStr = Buffer.concat(chunks).toString('utf-8');
        const { prompt, selectedModel } = JSON.parse(bodyStr || '{}');

        // Parse headers for hybrid auth
        const userApiKey = req.headers['x-api-key'] as string | undefined;
        const userId = req.headers['x-user-id'] as string | undefined;
        const apiProvider = (req.headers['x-api-provider'] as string) || 'openrouter';

        let result: any;

        // BRANCH A: BYOK - User provided their own API key
        if (userApiKey) {
          result = await generateContent({
            prompt,
            selectedModel,
            byok: { apiKey: userApiKey, provider: apiProvider },
          });
        } else {
          // BRANCH B: FREE TIER - No user key provided
          console.log('[Vite Proxy] No user API key, using free tier');

          if (!userId) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({
              error: 'MISSING_USER_ID',
              message: 'User ID is required for free tier usage'
            }));
          }

          // Get usage count from client (sent via header to avoid server-side Appwrite auth)
          const usageCountHeader = req.headers['x-usage-count'] as string | undefined;
          const usageCount = usageCountHeader ? parseInt(usageCountHeader, 10) : 0;

          if (usageCount >= FREE_TIER_LIMIT) {
            console.log(`[Vite Proxy] User ${userId} has exhausted free tier (${usageCount}/${FREE_TIER_LIMIT})`);
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({
              error: 'FREE_LIMIT_REACHED',
              message: 'Free trial exhausted. Please contact admin for more credits.',
              usageCount: usageCount
            }));
          }

          console.log(`[Vite Proxy] Using free tier for user ${userId} (${usageCount}/${FREE_TIER_LIMIT})`);
          result = await generateContent({
            prompt,
            selectedModel,
            byok: null,
            systemKeys: {
              anthropic: process.env.CLAUDE_API_KEY || env.CLAUDE_API_KEY,
              openrouter: process.env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY,
              groq: process.env.GROQ_API_KEY || env.GROQ_API_KEY,
            },
          });

          // Note: Usage count increment happens on client side after successful response
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(result));
      } catch (e: any) {
        console.error('[Vite Proxy] Error:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'AI proxy error', message: e?.message || String(e) }));
      }
    });

    server.middlewares.use('/api/generate-image', async (req: any, res: any) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        return res.end('Method Not Allowed');
      }

      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyStr = Buffer.concat(chunks).toString('utf-8');
        const { prompt, aspectRatio } = JSON.parse(bodyStr || '{}');

        if (!prompt) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Prompt is required' }));
        }

        const allowedRatios = ['1:1', '16:9', '9:16', '3:2', '2:3', '4:5', '5:4', '21:9', '9:21', '4:3', '3:4'];
        const ratio = allowedRatios.includes(aspectRatio) ? aspectRatio : '1:1';

        const replicateToken = process.env.REPLICATE_API_TOKEN || env.REPLICATE_API_TOKEN;
        if (!replicateToken) {
          console.error('[Vite Proxy] Missing REPLICATE_API_TOKEN');
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: 'Replicate API configuration missing' }));
        }

        console.log(`[Vite Proxy] Generating image with Replicate (flux-schnell)`);

        const response = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${replicateToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'wait'
          },
          body: JSON.stringify({
            input: {
              prompt: prompt,
              go_fast: true,
              megapixels: "1",
              num_outputs: 1,
              aspect_ratio: ratio,
              output_format: "webp",
              output_quality: 80,
              num_inference_steps: 4
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Vite Proxy] Replicate API error:', errorText);
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: `Replicate error: ${errorText}` }));
        }

        const prediction = await response.json();
        const imageUrl = prediction.output && prediction.output.length > 0 ? prediction.output[0] : null;

        if (!imageUrl) {
          console.error('[Vite Proxy] No image output from Replicate');
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: 'No image output from Replicate' }));
        }

        console.log(`[Vite Proxy] 🚀 Image generated: ${imageUrl}`);

        // Download server-side: replicate.delivery sends no CORS headers, so the
        // browser cannot fetch the bytes itself for the Appwrite Storage upload
        let imageBase64: string | null = null;
        try {
          const imgResp = await fetch(imageUrl);
          if (imgResp.ok) {
            const buf = Buffer.from(await imgResp.arrayBuffer());
            imageBase64 = `data:image/webp;base64,${buf.toString('base64')}`;
          }
        } catch (imgErr) {
          console.warn('[Vite Proxy] Could not download image bytes, returning URL only:', imgErr);
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ imageUrl, imageBase64 }));

      } catch (e: any) {
        console.error('[Vite Proxy] Error:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Image proxy error', message: e?.message || String(e) }));
      }
    });

    // Image CORS proxy for exports (avatar/doodle -> base64 for html2canvas).
    // Registered here so it works without the separate Express server on :3001.
    server.middlewares.use('/api/proxy-image', async (req: any, res: any) => {
      try {
        const urlObj = new URL(req.url || '', 'http://localhost');
        const target = urlObj.searchParams.get('url') || '';

        let parsed: URL;
        try {
          parsed = new URL(target);
        } catch {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Invalid url parameter' }));
        }

        const hostname = parsed.hostname;
        const isPrivate = hostname === 'localhost' || /^(\d+\.){3}\d+$/.test(hostname) || hostname.endsWith('.local');
        if (!/^https?:$/.test(parsed.protocol) || isPrivate) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'URL not allowed' }));
        }

        const upstream = await fetch(parsed.toString());
        if (!upstream.ok) {
          res.statusCode = upstream.status;
          return res.end(JSON.stringify({ error: `Upstream returned ${upstream.status}` }));
        }

        const buf = Buffer.from(await upstream.arrayBuffer());
        res.statusCode = 200;
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.end(buf);
      } catch (e: any) {
        console.error('[Vite Proxy] proxy-image error:', e);
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: 'proxy-image error', message: e?.message || String(e) }));
      }
    });

    // YouTube transcript fetch for the "paste a video link" composer flow.
    // Registered here so it works without the separate Express server on :3001.
    server.middlewares.use('/api/youtube-transcript', async (req: any, res: any) => {
      try {
        let body = '';
        for await (const chunk of req) body += chunk;
        const { videoId } = body ? JSON.parse(body) : {};

        if (!videoId) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Video ID is required' }));
        }

        const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
        if (!transcriptItems || transcriptItems.length === 0) {
          res.statusCode = 404;
          return res.end(JSON.stringify({ error: 'No transcript available for this video. The video may not have captions.' }));
        }

        const fullTranscript = transcriptItems.map((item: any) => item.text).join(' ').replace(/\s+/g, ' ').trim();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ transcript: fullTranscript }));
      } catch (e: any) {
        console.error('[Vite Proxy] youtube-transcript error:', e);
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: e?.message || String(e) }));
      }
    });

    // Article scraper for the "paste a link" composer flow. Same private-host
    // SSRF guard as proxy-image; strips scripts/styles/tags to plain text.
    server.middlewares.use('/api/scrape', async (req: any, res: any) => {
      try {
        const urlObj = new URL(req.url || '', 'http://localhost');
        const target = urlObj.searchParams.get('url') || '';

        let parsed: URL;
        try {
          parsed = new URL(target);
        } catch {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Invalid url parameter' }));
        }

        const hostname = parsed.hostname;
        const isPrivate = hostname === 'localhost' || /^(\d+\.){3}\d+$/.test(hostname) || hostname.endsWith('.local');
        if (!/^https?:$/.test(parsed.protocol) || isPrivate) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'URL not allowed' }));
        }

        const upstream = await fetch(parsed.toString(), {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });
        if (!upstream.ok) {
          res.statusCode = upstream.status;
          return res.end(JSON.stringify({ error: `Upstream returned ${upstream.status}` }));
        }

        const contentType = upstream.headers.get('content-type') || '';
        if (!contentType.includes('html') && !contentType.includes('text')) {
          res.statusCode = 415;
          return res.end(JSON.stringify({ error: 'That URL did not return a readable page' }));
        }

        const html = await upstream.text();
        const fullText = htmlToReadableText(html);
        const content = fullText.slice(0, MAX_SOURCE_CONTENT_CHARS);

        if (content.length < 100) {
          res.statusCode = 422;
          return res.end(JSON.stringify({ error: 'Could not extract readable content from this page' }));
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          content,
          title: extractTitle(html),
          truncated: fullText.length > MAX_SOURCE_CONTENT_CHARS,
          originalLength: fullText.length,
        }));
      } catch (e: any) {
        console.error('[Vite Proxy] scrape error:', e);
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: e?.message || String(e) }));
      }
    });
  }
});

// Load environment variables from multiple possible locations
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), ' .env.local') });
dotenv.config({ path: path.resolve(process.cwd(), ' .env') });
dotenv.config();

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api/doodles-input': 'http://localhost:3001',
        '/api/image-output': 'http://localhost:3001',
        '/api/generate-doodle': 'http://localhost:3001',
        '/api/proxy-image': 'http://localhost:3001',
        '/api/save-image-output': 'http://localhost:3001',
      }
    },
    plugins: [react(), aiModelProxyPlugin(env)],
    define: {
      // AI Model API Keys
      'process.env.CLAUDE_API_KEY': JSON.stringify(env.CLAUDE_API_KEY || process.env.CLAUDE_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY),
      // Referenced as a fallback in ResearchAgent.ts so the same source runs
      // unmodified in the background worker (plain Node, no import.meta.env).
      'process.env.TAVILY_API_KEY': JSON.stringify(env.TAVILY_API_KEY || process.env.TAVILY_API_KEY),
      'process.env.VITE_TAVILY_API_KEY': JSON.stringify(env.VITE_TAVILY_API_KEY || process.env.VITE_TAVILY_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        external: [
          'node:async_hooks',
          '../core/llm/agentGateway'
        ]
      }
    }
  };
});