import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import dotenv from 'dotenv';
import react from '@vitejs/plugin-react';
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { ChatGroq } from '@langchain/groq';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { FREE_TIER_LIMIT } from './config/constants';
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
              selectedModel === 'deepseek-r1t' ? 'tngtech/deepseek-r1t-chimera:free' :
                selectedModel === 'claude-haiku-openrouter' ? 'anthropic/claude-3.5-haiku' :
                  selectedModel === 'gemini-2.5-flash' ? 'google/gemini-2.5-flash' :
                    selectedModel === 'gemini-2.0-flash-exp' ? 'google/gemini-2.0-flash-exp:free' :
                      selectedModel === 'grok-4.1-fast' ? 'x-ai/grok-4.1-fast' :
                        selectedModel === 'gpt-4o' ? 'openai/gpt-4o' :
                          selectedModel === 'gpt-4-turbo' ? 'openai/gpt-4-turbo' :
                            selectedModel === 'claude-sonnet' ? 'anthropic/claude-3.5-sonnet' :
                              selectedModel === 'claude-haiku' ? 'anthropic/claude-3.5-haiku' :
                                'tngtech/deepseek-r1t-chimera:free';

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
              })
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error('[Vite Proxy] OpenRouter error:', errorText);
              throw new Error(`OpenRouter API error: ${errorText}`);
            }

            const data = await response.json();
            result = cleanJsonResponse(data.choices[0]?.message?.content || '{"slides":[]}');

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
                selectedModel === 'claude-haiku' ? 'claude-3-5-haiku-20241022' :
                  'claude-3-5-haiku-20241022'; // Default

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
          if (selectedModel === 'claude-haiku-openrouter') {
            // Use system Anthropic API for Claude Haiku
            const anthropicKey = process.env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY || '';
            if (!anthropicKey) {
              console.error('[Vite Proxy] Missing ANTHROPIC_API_KEY for free tier Claude');
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: 'Missing ANTHROPIC_API_KEY for free tier' }));
            }

            console.log('[Vite Proxy] Using system Anthropic API for Claude Haiku');

            const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': anthropicKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'claude-3-5-haiku-20241022',
                max_tokens: 4096,
                messages: [
                  { role: 'user', content: `${systemPrompt}\n\n${prompt}` }
                ],
                temperature: 0.2,
              })
            });

            if (!anthropicResponse.ok) {
              const errorText = await anthropicResponse.text();
              console.error('[Vite Proxy] Anthropic API error:', errorText);
              throw new Error(`Anthropic API error: ${errorText}`);
            }

            const anthropicData = await anthropicResponse.json();
            result = cleanJsonResponse(anthropicData.content[0]?.text || '{"slides":[]}');

          } else {
            // Use system OpenRouter API for DeepSeek and others
            const openrouterKey = process.env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY || '';
            if (!openrouterKey) {
              console.error('[Vite Proxy] Missing OPENROUTER_API_KEY for free tier');
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: 'Missing OPENROUTER_API_KEY for free tier' }));
            }

            console.log('[Vite Proxy] Using system OpenRouter API for DeepSeek');

            const freeModel =
              selectedModel === 'deepseek-r1t' ? 'tngtech/deepseek-r1t-chimera:free' :
                selectedModel === 'gemini-2.0-flash-exp' ? 'google/gemini-2.0-flash-exp:free' :
                  'tngtech/deepseek-r1t-chimera:free'; // Default to DeepSeek

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
        const { prompt } = JSON.parse(bodyStr || '{}');

        if (!prompt) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Prompt is required' }));
        }

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
              aspect_ratio: "1:1",
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
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ imageUrl }));

      } catch (e: any) {
        console.error('[Vite Proxy] Error:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Image proxy error', message: e?.message || String(e) }));
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
        '/api/youtube-transcript': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        }
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