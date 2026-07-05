import { generateContentFromAgent } from '../../services/aiService';
import { ANALYSIS_SYSTEM_PROMPT, getAnalysisUserPrompt } from './prompts/researchPrompts';

export interface ResearchAnalysis {
    strategy: 'EXPLORATORY' | 'CONTEXTUAL' | 'NONE';
    reasoning: string;
    searchQueries: string[];
}

const ANALYSIS_SCHEMA = {
    type: 'object',
    properties: {
        strategy: { type: 'string', enum: ['EXPLORATORY', 'CONTEXTUAL', 'NONE'] },
        reasoning: { type: 'string' },
        searchQueries: {
            type: 'array',
            items: { type: 'string' }
        }
    },
    required: ['strategy', 'reasoning', 'searchQueries']
};

export const ResearchAgent = {
    analyzeInputNeeds: async (input: string): Promise<ResearchAnalysis> => {
        console.log('[ResearchAgent] 🧠 analyzeInputNeeds started for input length:', input.length);

        const combinedPrompt = `
      ${ANALYSIS_SYSTEM_PROMPT}

      USER_INPUT:
      ${getAnalysisUserPrompt(input)}
    `;

        const result = await generateContentFromAgent(
            combinedPrompt,
            ANALYSIS_SCHEMA
        );

        // Some models might wrap it
        const analysis = result.analysis || result;
        return analysis as ResearchAnalysis;
    },

    performResearch: async (queries: string[]): Promise<string> => {
        if (!queries || queries.length === 0) return '';

        // Runs both in the browser (Vite injects import.meta.env) and in the
        // background worker (plain Node — import.meta.env is undefined there,
        // so fall back to process.env; dotenv loads the same .env file worker-side,
        // VITE_ prefix and all, so TAVILY_API_KEY doesn't need to be duplicated).
        const apiKey = (import.meta as any).env?.VITE_TAVILY_API_KEY || process.env.TAVILY_API_KEY || process.env.VITE_TAVILY_API_KEY;
        if (!apiKey) {
            console.error('[ResearchAgent] ❌ Tavily API key missing. Set VITE_TAVILY_API_KEY (browser) or TAVILY_API_KEY (worker).');
            return 'Research skipped due to missing API key.';
        }

        try {
            console.log(`[ResearchAgent] 🌍 Searching on Tavily for:`, queries);

            const results = await Promise.all(queries.map(async (query) => {
                const response = await fetch('https://api.tavily.com/search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        api_key: apiKey,
                        query: query,
                        include_answer: true,
                        search_depth: 'advanced'
                    })
                });

                if (!response.ok) {
                    throw new Error(`Tavily API error: ${response.statusText}`);
                }

                const data = await response.json();
                console.log(`[ResearchAgent] 📊 Research results for "${query}":`, data);

                return {
                    query,
                    answer: data.answer,
                    results: data.results.map((r: any) => ({
                        title: r.title,
                        content: r.content,
                        url: r.url
                    })).slice(0, 3) // Keep it concise
                };
            }));

            // Format results into a readable string
            let formattedResults = "\n\n=== AI RESEARCH ENRICHMENT ===\n";
            results.forEach((res, idx) => {
                formattedResults += `\nQuery ${idx + 1}: ${res.query}\n`;
                if (res.answer) {
                    formattedResults += `Summary: ${res.answer}\n`;
                }
                res.results.forEach((r: any) => {
                    formattedResults += `- ${r.title}: ${r.content.substring(0, 200)}... (${r.url})\n`;
                });
            });

            return formattedResults;
        } catch (error) {
            console.error('[ResearchAgent] Research failed:', error);
            return '\n\n=== AI RESEARCH ENRICHMENT ===\nResearch failed to execute.';
        }
    }
};
