import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import dotenv from 'dotenv';
import react from '@vitejs/plugin-react';
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { ChatGroq } from '@langchain/groq';

const groqProxyPlugin = (env: Record<string, string>) => ({
  name: 'groq-proxy',
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
        const { prompt, responseSchema } = JSON.parse(bodyStr || '{}');

        const apiKey = process.env.GROQ_API_KEY || env.VITE_GROQ_API_KEY || env.GROQ_API_KEY || '';
        if (!apiKey) {
          console.info('[groq-proxy] env presence', {
            hasProcess: !!process.env.GROQ_API_KEY,
            hasViteGroq: !!env.VITE_GROQ_API_KEY,
            hasEnvGroq: !!env.GROQ_API_KEY
          });
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Missing GROQ_API_KEY' }));
        }
        const llm = new ChatGroq({ model: 'llama-3.3-70b-versatile', temperature: 0.2, apiKey });
        const workflow = new StateGraph(MessagesAnnotation)
          .addNode('callModel', async (state) => {
            const ai = await llm.invoke([
              { role: 'system', content: 'You are a specialized content agent for LinkedIn carousels. Output valid JSON only.' },
              { role: 'user', content: prompt }
            ], { response_format: { type: 'json_object' } });
            return { messages: ai };
          })
          .addEdge('__start__', 'callModel');

        const graph = workflow.compile();
        const out = await graph.invoke({ messages: [] });
        const last = out.messages[out.messages.length - 1];
        const text = (typeof last.content === 'string' ? last.content : JSON.stringify(last.content)) || '{"slides":[]}';
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(text);
      } catch (e: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Groq proxy error', message: e?.message || String(e) }));
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
    plugins: [react(), groqProxyPlugin(env)],
    define: {
      // Groq API Key (existing)
      'process.env.GROQ_API_KEY': JSON.stringify(env.GROQ_API_KEY || process.env.GROQ_API_KEY),

      // Supabase Configuration (new)
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