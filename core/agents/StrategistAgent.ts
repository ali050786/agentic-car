import { generateContentFromAgent } from '../../services/aiService';

// JSON Schema for the Strategist's output
const STRATEGIST_SCHEMA = {
    type: 'object',
    properties: {
        premise: {
            type: 'string',
            description: "The specific 'Viral Angle' or core argument. Must be punchy and specific."
        },
        audience: {
            type: 'string',
            description: "The specific target audience for this post."
        },
        takeaway: {
            type: 'string',
            description: "The single key lesson or action point."
        }
    },
    required: ['premise', 'audience', 'takeaway']
};

export const StrategistAgent = {
    id: 'strategist',
    name: 'The Brain',

    /**
     * Generates a "Viral Angle" based on the input and user vibe.
     */
    generateViralAngle: async (
        input: string,
        inputType: 'TOPIC' | 'CONTEXT',
        instructions: string
    ): Promise<string> => {

        // TRUNCATION: If input is 'CONTEXT' (long text), truncate to ~6000 tokens (~24k chars)
        // to ensure we don't blow up the context window for reasoning.
        let processedInput = input;
        if (inputType === 'CONTEXT' && input.length > 24000) {
            console.log(`[StrategistAgent] Truncating input from ${input.length} to 24000 chars`);
            processedInput = input.substring(0, 24000) + "... [TRUNCATED]";
        }

        const systemPrompt = `
      You are a Viral Content Strategist.
      
      ═══════════════════════════════════════════════════════════════════════
      INPUT INFORMATION
      ═══════════════════════════════════════════════════════════════════════
      INPUT_TYPE: ${inputType}
      ${instructions ? `USER_VIBE/INSTRUCTIONS: ${instructions}` : ''}

      INPUT_DATA:
      """
      ${processedInput}
      """
      ═══════════════════════════════════════════════════════════════════════
      
      YOUR TASK:
      Analyze the input and generate a specific "Viral Angle" or "Premise" for a LinkedIn Carousel.
      
      LOGIC:
      1. **Ignore generic advice.** If the input is broad (e.g., "Leadership"), do NOT output "How to be a leader". 
      2. **Apply the Vibe:**
         - If User Vibe is 'Contrarian' -> Find a conflict, myth, or lie to bust.
         - If User Vibe is 'Analytical' -> Focus on a specific data point, proof, or framework.
         - If User Vibe is 'Storyteller' -> Find a hero/villain arc or a personal transformation.
         - If User Vibe is 'Actionable' -> Focus on a specific "How-to" without fluff.
      
      MODE SPECIFIC:
      - If INPUT_TYPE is 'TOPIC' (Short): You are a **Creator**. Brainstorm a high-stakes, specific angle based on the topic.
      - If INPUT_TYPE is 'CONTEXT' (Long Text/PDF): You are a **Repurposer**. Analyze the source material and extract the *single* most interesting insight, argument, or statistic that matches the Vibe.
      
      OUTPUT REQUIREMENTS:
      Return a JSON object with:
      - premise: The specific angle. (e.g., "Stop celebrating 5% growth. Retention is killing you.")
      - audience: Who is this for? (e.g., "SaaS Founders doing $1M+ ARR")
      - takeaway: The main lesson. (e.g., "Focus on NRR, not just ARR.")
    `;

        try {
            console.log('[StrategistAgent] Generating Viral Angle...');
            const result = await generateContentFromAgent(systemPrompt, STRATEGIST_SCHEMA);

            // Parse result (handle nested 'carousel' or direct object if the wrapper adds it, 
            // though generateContentFromAgent usually returns the parsed JSON)
            const data = result.viralAngle || result;

            if (!data || !data.premise) {
                throw new Error('Invalid response from Strategist Agent');
            }

            console.log('[StrategistAgent] Generated Angle:', data);

            // Format the output as a structured string for the Writer Agent
            const formattedAngle = `
        **VIRAL ANGLE STRATEGY**:
        - **Premise/Hook**: ${data.premise}
        - **Target Audience**: ${data.audience}
        - **Key Takeaway**: ${data.takeaway}
        
        (Strictly follow this angle. Do not deviate to generic advice.)
      `.trim();

            return formattedAngle;

        } catch (error) {
            console.error('[StrategistAgent] Error:', error);
            // Fallback: If Strategist fails, just return the raw input so the Writer can at least try.
            console.warn('[StrategistAgent] Falling back to raw input.');
            return `Topic/Context: ${input}\n(Strategist failed, use this raw input directly)`;
        }
    }
};
