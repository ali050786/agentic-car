import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import dotenv from 'dotenv';
import react from '@vitejs/plugin-react';
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { ChatGroq } from '@langchain/groq';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

        let result: any;

        // Route to appropriate model based on selection
        if (selectedModel === 'groq-llama') {
          // Groq Llama 3.3 70B
          const groqKey = process.env.GROQ_API_KEY || env.GROQ_API_KEY || '';
          if (!groqKey) {
            console.error('[ai-proxy] Missing GROQ_API_KEY');
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Missing GROQ_API_KEY' }));
          }

          console.log('[ai-proxy] Using Groq Llama 3.3 70B');
          const llm = new ChatGroq({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.2,
            apiKey: groqKey,
          });

          const workflow = new StateGraph(MessagesAnnotation)
            .addNode('callModel', async (state) => {
              const systemPrompt = 'You are a specialized content agent for LinkedIn carousels. You MUST respond with ONLY valid JSON. No comments, no extra text, no markdown code blocks. Pure JSON only.';
              const invokeOptions = { response_format: { type: 'json_object' as const } };
              const ai = await llm.invoke([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
              ], invokeOptions);
              return { messages: ai };
            })
            .addEdge('__start__', 'callModel');

          const graph = workflow.compile();
          const out = await graph.invoke({ messages: [] });
          const last = out.messages[out.messages.length - 1];
          result = (typeof last.content === 'string' ? last.content : JSON.stringify(last.content)) || '{"slides":[]}';

        } else if (selectedModel === 'gemini-flash') {
          // Gemini Flash (direct API)
          const geminiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || '';
          if (!geminiKey) {
            console.error('[ai-proxy] Missing GEMINI_API_KEY');
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Missing GEMINI_API_KEY' }));
          }

          console.log('[ai-proxy] Using Gemini 2.5 Flash');
          const genAI = new GoogleGenerativeAI(geminiKey);
          const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
          });

          const systemPrompt = 'You are a specialized content agent for LinkedIn carousels. You MUST respond with ONLY valid JSON. No comments, no extra text, no markdown code blocks. Pure JSON only.';
          const fullPrompt = `${systemPrompt}\n\n${prompt}`;

          const geminiResult = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            generationConfig: {
              temperature: 0.2,
            },
          });
          const response = geminiResult.response;
          result = response.text() || '{"slides":[]}';

        } else if (selectedModel === 'openrouter-gemini') {
          // OpenRouter Gemini 2.0 Flash (via OpenRouter)
          const openrouterKey = process.env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY || '';
          if (!openrouterKey) {
            console.error('[ai-proxy] Missing OPENROUTER_API_KEY');
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Missing OPENROUTER_API_KEY' }));
          }

          console.log('[ai-proxy] Using OpenRouter Gemini 2.0 Flash');

          const systemPrompt = 'You are a specialized content agent for LinkedIn carousels. You MUST respond with ONLY valid JSON. No comments, no extra text, no markdown code blocks. Pure JSON only.';

          const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openrouterKey}`,
              'HTTP-Referer': 'http://localhost:3000',
              'X-Title': 'Agentic Carousel Generator',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'google/gemini-2.0-flash-exp:free',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
              ],
              temperature: 0.2,
            })
          });

          if (!openrouterResponse.ok) {
            const errorText = await openrouterResponse.text();
            throw new Error(`OpenRouter API error: ${errorText}`);
          }

          const openrouterData = await openrouterResponse.json();
          result = openrouterData.choices[0]?.message?.content || '{"slides":[]}';

        } else {
          // Claude Haiku 3.5 (direct API)
          const claudeKey = process.env.CLAUDE_API_KEY || env.CLAUDE_API_KEY || '';
          if (!claudeKey) {
            console.error('[ai-proxy] Missing CLAUDE_API_KEY');
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Missing CLAUDE_API_KEY' }));
          }

          console.log('[ai-proxy] Using Claude Haiku 3.5');
          const anthropic = new Anthropic({
            apiKey: claudeKey,
          });

          const systemPrompt = 'You are a specialized content agent for LinkedIn carousels. You MUST respond with ONLY valid JSON. No comments, no extra text, no markdown code blocks. Pure JSON only.';

          const response = await anthropic.messages.create({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 4096,
            temperature: 0.2,
            system: systemPrompt,
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ]
          });

          // Extract text from Claude response
          const textContent = response.content.find(block => block.type === 'text');
          result = textContent && 'text' in textContent ? textContent.text : '{"slides":[]}';
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(result);
      } catch (e: any) {
        console.error('[ai-proxy] Error:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'AI proxy error', message: e?.message || String(e) }));
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
    },
    plugins: [react(), aiModelProxyPlugin(env)],
    define: {
      // AI Model API Keys
      'process.env.CLAUDE_API_KEY': JSON.stringify(env.CLAUDE_API_KEY || process.env.CLAUDE_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY),

      // Supabase Configuration
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});