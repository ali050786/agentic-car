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
dotenv.config();

// Helper to extract JSON from markdown code blocks
const cleanJsonResponse = (text: string): string => {
  // 1. Try to match markdown code blocks first
  const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (jsonMatch) {
    return jsonMatch[1];
  }

  // 2. Try to find the first '{' and last '}'
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1);
  }

  // 3. Return as-is if no structure found (fallback)
  return text.trim();
};

/**
 * Cleans a model response AND logs a full diagnostic so developers can see
 * why an edit produced no slides: was it truncation (finish_reason=length),
 * invalid JSON, or a genuinely empty/refused answer? Returns the cleaned
 * string (unchanged behavior) — logging is the only side effect.
 */
const cleanAndDiagnose = (choice: any, model: string, label: string): string => {
  const content = choice?.message?.content ?? choice?.content ?? '';
  const finishReason = choice?.finish_reason ?? choice?.native_finish_reason ?? 'unknown';
  const cleaned = cleanJsonResponse(content || '{"slides":[]}');

  let parsed: any = null;
  let parseError = '';
  try { parsed = JSON.parse(cleaned); } catch (e: any) { parseError = e?.message || 'parse failed'; }

  const truncated = finishReason === 'length';
  const diag = {
    label,
    model,
    finishReason,
    truncated,
    rawLen: (content || '').length,
    validJson: !parseError,
    parseError: parseError || undefined,
    keys: parsed && typeof parsed === 'object' ? Object.keys(parsed) : undefined,
    slideCount: Array.isArray(parsed?.slides) ? parsed.slides.length : undefined,
    intent: parsed?.intent,
  };

  if (truncated || parseError) {
    console.error(`[Vite Proxy] ⚠️ MODEL RESPONSE PROBLEM (${label}):`, JSON.stringify(diag));
    if (truncated) console.error(`[Vite Proxy]    → Response hit the token limit and was cut off. Raise max_tokens or reduce the request size.`);
    if (parseError) console.error(`[Vite Proxy]    → Cleaned output is not valid JSON. First 300 chars:`, cleaned.slice(0, 300));
  } else {
    console.log(`[Vite Proxy] ✓ Model response OK (${label}):`, JSON.stringify(diag));
  }

  return cleaned;
};

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
        const { prompt, responseSchema, selectedModel } = JSON.parse(bodyStr || '{}');

        // Parse headers for hybrid auth
        const userApiKey = req.headers['x-api-key'] as string | undefined;
        const userId = req.headers['x-user-id'] as string | undefined;
        const apiProvider = (req.headers['x-api-provider'] as string) || 'openrouter';

        let result: any;
        let usingSystemKey = false;

        // BRANCH A: BYOK - User provided their own API key
        if (userApiKey) {
          console.log('[Vite Proxy] Using user-provided API key (BYOK)');
          console.log('[Vite Proxy] Provider:', apiProvider);
          console.log('[Vite Proxy] Selected model:', selectedModel);

          const systemPrompt = 'You are a specialized content agent for LinkedIn carousels. ERROR HANDLING: You MUST respond with ONLY valid JSON. Do NOT include any conversational filler like "Alright" or "Here is the JSON". Do NOT wrap the output in markdown code blocks if possible, but pure JSON string is best. START YOUR RESPONSE WITH { AND END WITH }.';

          // Route to correct API based on provider
          if (apiProvider === 'openrouter') {
            // OpenRouter - supports all models
            const model =
              selectedModel === 'gpt-oss-120b' ? 'openai/gpt-oss-120b:free' :
              selectedModel === 'deepseek-r1t' ? 'openai/gpt-oss-120b:free' :
                selectedModel === 'claude-haiku-openrouter' ? 'anthropic/claude-3.5-haiku' :
                  selectedModel === 'gemini-2.5-flash' ? 'google/gemini-2.5-flash' :
                    selectedModel === 'gemini-2.0-flash-exp' ? 'google/gemini-2.0-flash-exp:free' :
                      selectedModel === 'grok-4.1-fast' ? 'x-ai/grok-4.1-fast' :
                        selectedModel === 'gpt-4o' ? 'openai/gpt-4o' :
                          selectedModel === 'gpt-4-turbo' ? 'openai/gpt-4-turbo' :
                            selectedModel === 'claude-sonnet' ? 'anthropic/claude-3.5-sonnet' :
                              selectedModel === 'claude-haiku' ? 'anthropic/claude-3.5-haiku' :
                                'openai/gpt-oss-120b:free';

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${userApiKey}`,
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Agentic Carousel Generator',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: prompt }
                ],
                temperature: 0.2,
                max_tokens: 8000,
              })
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error('[Vite Proxy] OpenRouter error:', errorText);
              throw new Error(`OpenRouter API error: ${errorText}`);
            }

            const data = await response.json();
            result = cleanAndDiagnose(data.choices[0], model, 'BYOK openrouter');

          } else if (apiProvider === 'openai') {
            // OpenAI API - only GPT models
            const model =
              selectedModel === 'gpt-4o' ? 'gpt-4o' :
                selectedModel === 'gpt-4-turbo' ? 'gpt-4-turbo-preview' :
                  'gpt-4o'; // Default

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${userApiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: prompt }
                ],
                temperature: 0.2,
              })
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error('[Vite Proxy] OpenAI error:', errorText);
              throw new Error(`OpenAI API error: ${errorText}`);
            }

            const data = await response.json();
            result = cleanJsonResponse(data.choices[0]?.message?.content || '{"slides":[]}');

          } else if (apiProvider === 'anthropic') {
            // Anthropic API - only Claude models
            const model =
              selectedModel === 'claude-sonnet' ? 'claude-sonnet-4-5-20250929' :
                selectedModel === 'claude-haiku' ? 'claude-haiku-4-5-20251001' :
                  'claude-haiku-4-5-20251001'; // Default

            const response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': userApiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model,
                max_tokens: 4096,
                messages: [
                  { role: 'user', content: `${systemPrompt}\n\n${prompt}` }
                ],
                temperature: 0.2,
              })
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error('[Vite Proxy] Anthropic error:', errorText);
              throw new Error(`Anthropic API error: ${errorText}`);
            }

            const data = await response.json();
            result = cleanJsonResponse(data.content[0]?.text || '{"slides":[]}');

          } else {
            throw new Error(`Unsupported API provider: ${apiProvider}`);
          }
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
              message: 'Free trial exhausted. Please add your API key to continue.',
              usageCount: usageCount
            }));
          }

          // Use system keys for free tier
          console.log(`[Vite Proxy] Using free tier for user ${userId} (${usageCount}/${FREE_TIER_LIMIT})`);
          usingSystemKey = true;

          const systemPrompt = 'You are a specialized content agent for LinkedIn carousels. ERROR HANDLING: You MUST respond with ONLY valid JSON. Do NOT include any conversational filler like "Alright" or "Here is the JSON". Do NOT wrap the output in markdown code blocks if possible, but pure JSON string is best. START YOUR RESPONSE WITH { AND END WITH }.';

          // Free tier: Route based on selected model
          if (selectedModel === 'claude-haiku' || selectedModel === 'claude-sonnet') {
            // Try direct Anthropic first if key available
            const anthropicKey = process.env.CLAUDE_API_KEY || env.CLAUDE_API_KEY || '';

            if (anthropicKey) {
              console.log(`[Vite Proxy] Using system Anthropic API for ${selectedModel}`);
              const model = selectedModel === 'claude-sonnet' ? 'claude-sonnet-4-5-20250929' : 'claude-haiku-4-5-20251001';

              const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'x-api-key': anthropicKey,
                  'anthropic-version': '2023-06-01',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  model,
                  max_tokens: 4096,
                  messages: [
                    { role: 'user', content: `${systemPrompt}\n\n${prompt}` }
                  ],
                  temperature: 0.2,
                })
              });

              if (response.ok) {
                const data = await response.json();
                result = cleanJsonResponse(data.content[0]?.text || '{"slides":[]}');
              } else {
                const errorText = await response.text();
                console.error('[Vite Proxy] Anthropic error fallback:', errorText);
                // Fall back to OpenRouter below
              }
            }

            if (!result) {
              // Use system OpenRouter API for Claude models
              const openrouterKey = process.env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY || '';
              if (!openrouterKey) {
                console.error('[Vite Proxy] Missing OPENROUTER_API_KEY for free tier');
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: 'Missing OPENROUTER_API_KEY for free tier' }));
              }

              const freeModel = selectedModel === 'claude-haiku'
                ? 'anthropic/claude-3.5-haiku'
                : 'anthropic/claude-3.5-sonnet';

              console.log(`[Vite Proxy] Using system OpenRouter API for ${selectedModel} (model: ${freeModel})`);

              const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openrouterKey}`,
                  'HTTP-Referer': 'http://localhost:3000',
                  'X-Title': 'Agentic Carousel Generator',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  model: freeModel,
                  messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                  ],
                  temperature: 0.2,
                })
              });

              if (!openrouterResponse.ok) {
                const errorText = await openrouterResponse.text();
                console.error('[Vite Proxy] OpenRouter API error:', errorText);
                throw new Error(`OpenRouter API error: ${errorText}`);
              }

              const openrouterData = await openrouterResponse.json();
              result = cleanJsonResponse(openrouterData.choices[0]?.message?.content || '{"slides":[]}');
            }

          } else {
            // Use system OpenRouter API for free tier (Default)
            const openrouterKey = process.env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY || '';
            if (!openrouterKey) {
              console.error('[Vite Proxy] Missing OPENROUTER_API_KEY for free tier');
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: 'Missing OPENROUTER_API_KEY for free tier' }));
            }

            // Free OpenRouter endpoints are frequently rate-limited upstream,
            // so try each model in order until one responds
            const freeModels = [
              'openai/gpt-oss-120b:free',
              'openai/gpt-oss-20b:free',
              'meta-llama/llama-3.3-70b-instruct:free',
              'qwen/qwen3-next-80b-a3b-instruct:free',
            ];

            let lastError = '';
            for (const freeModel of freeModels) {
              console.log(`[Vite Proxy] Using system OpenRouter API for ${selectedModel || 'default'} (model: ${freeModel})`);

              const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openrouterKey}`,
                  'HTTP-Referer': 'http://localhost:3000',
                  'X-Title': 'Agentic Carousel Generator',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  model: freeModel,
                  messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                  ],
                  temperature: 0.2,
                  max_tokens: 8000,
                })
              });

              if (openrouterResponse.ok) {
                const openrouterData = await openrouterResponse.json();
                const content = openrouterData.choices[0]?.message?.content;
                if (content) {
                  result = cleanAndDiagnose(openrouterData.choices[0], freeModel, 'free-tier default');
                  break;
                }
                lastError = `Empty response from ${freeModel}`;
                console.error('[Vite Proxy]', lastError);
              } else {
                lastError = await openrouterResponse.text();
                console.error(`[Vite Proxy] OpenRouter error for ${freeModel}, trying next:`, lastError);
              }
            }

            if (!result) {
              throw new Error(`OpenRouter API error: ${lastError}`);
            }
          }

          // Note: Usage count increment happens on client side after successful response
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(result);
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
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AgenticCarouselBot/1.0)' },
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
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});