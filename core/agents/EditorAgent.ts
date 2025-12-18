import { generateContentFromAgent } from '../../services/aiService';

// JSON Schema for Headline Alternatives
const HEADLINE_SCHEMA = {
    type: 'object',
    properties: {
        alternatives: {
            type: 'array',
            items: { type: 'string' },
            description: "A list of 3 distinct, punchy headline variations."
        }
    },
    required: ['alternatives']
};

// JSON Schema for Text Refinement
const REFINEMENT_SCHEMA = {
    type: 'object',
    properties: {
        refinedText: {
            type: 'string',
            description: "The rewritten version of the text."
        }
    },
    required: ['refinedText']
};

export type RefinementGoal = 'CLARITY' | 'PUNCHIER' | 'GRAMMAR';

export const EditorAgent = {
    id: 'editor',
    name: 'The Editor',

    /**
     * Refines a block of text based on a specific goal.
     */
    refineText: async (
        text: string,
        goal: RefinementGoal,
        context?: string
    ): Promise<string> => {
        const systemPrompt = `
      You are a World-Class Editor for LinkedIn Carousels.
      
      YOUR TASK:
      Rewrite the following text based on the GOAL.
      
      GOAL:
      ${goal === 'CLARITY' ? '- Make it crystal clear and easy to understand. Remove jargon. Use simple words.' : ''}
      ${goal === 'PUNCHIER' ? '- Make it short, punchy, and impactful. Cut fluff. Use strong verbs.' : ''}
      ${goal === 'GRAMMAR' ? '- Fix all grammar and spelling errors. Maintain the original tone.' : ''}
      
      INPUT TEXT:
      "${text}"
      
      ${context ? `CONTEXT: ${context}` : ''}
      
      OUTPUT REQUIREMENTS:
      - Return ONLY the rewritten text in the JSON field 'refinedText'.
      - Do not add quotes or explanations.
    `;

        try {
            console.log(`[EditorAgent] Refining text with goal: ${goal}...`);
            const result = await generateContentFromAgent(systemPrompt, REFINEMENT_SCHEMA);

            // Handle potential different return structures
            const refined = result.refinedText || result;

            if (!refined) {
                throw new Error('Invalid response from Editor Agent');
            }

            return refined;
        } catch (error) {
            console.error('[EditorAgent] Error:', error);
            throw error;
        }
    },

    /**
     * Generates 3 alternative headlines.
     */
    generateHeadlineAlternatives: async (
        currentHeadline: string,
        context?: string
    ): Promise<string[]> => {
        const systemPrompt = `
      You are a Viral Headline Expert.
      
      YOUR TASK:
      Generate 3 distinct alternative headlines for the given headline.
      
      CURRENT HEADLINE:
      "${currentHeadline}"
      
      ${context ? `CONTEXT: ${context}` : ''}
      
      CRITERIA:
      1. Must be punchy and attention-grabbing.
      2. Must be under 10 words.
      3. Use different angles (e.g., curiosity-driven, benefit-driven, contrarian).
      
      OUTPUT REQUIREMENTS:
      - Return a JSON object with an array 'alternatives' containing 3 strings.
    `;

        try {
            console.log('[EditorAgent] Generating headline alternatives...');
            const result = await generateContentFromAgent(systemPrompt, HEADLINE_SCHEMA);

            const alternatives = result.alternatives || result;

            if (!Array.isArray(alternatives) || alternatives.length === 0) {
                // Fallback if structure is weird but maybe single string? Unlikely with schema.
                if (typeof alternatives === 'string') return [alternatives];
                throw new Error('Invalid response from Editor Agent');
            }

            return alternatives;
        } catch (error) {
            console.error('[EditorAgent] Error:', error);
            throw error;
        }
    }
};
