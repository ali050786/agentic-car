import { generateContentFromAgent } from '../../services/aiService';
import { CreativeBrief } from '../../types';

// JSON Schema for the Strategist's output
const STRATEGIST_SCHEMA = {
    type: 'object',
    properties: {
        premise: {
            type: 'string',
            description: "The specific angle, factual spine, narrative arc, or step list — depending on mode."
        },
        audience: {
            type: 'string',
            description: "The specific target audience for this carousel."
        },
        takeaway: {
            type: 'string',
            description: "The single key insight, emotion, or action point the reader should leave with."
        }
    },
    required: ['premise', 'audience', 'takeaway']
};

export const StrategistAgent = {
    id: 'strategist',
    name: 'The Brain',

    /**
     * Generates a content strategy based on the Creative Brief.
     *
     * When approachMode is VIRAL_ANGLE → generates a LinkedIn viral hook (old behaviour).
     * When approachMode is FACTUAL_SPINE → ordered key facts / educational structure.
     * When approachMode is NARRATIVE_ARC → story arc: setup → conflict → resolution.
     * When approachMode is HOW_TO_STEPS → numbered step list for a tutorial.
     *
     * Falls back to VIRAL_ANGLE if no brief is supplied (backward compatibility).
     */
    generateViralAngle: async (
        input: string,
        inputType: 'TOPIC' | 'CONTEXT',
        instructions: string,
        brief?: CreativeBrief
    ): Promise<string> => {

        // Truncate long context inputs
        let processedInput = input;
        if (inputType === 'CONTEXT' && input.length > 24000) {
            console.log(`[StrategistAgent] Truncating input from ${input.length} to 24000 chars`);
            processedInput = input.substring(0, 24000) + "... [TRUNCATED]";
        }

        const approachMode = brief?.contentStrategy?.approachMode ?? 'VIRAL_ANGLE';
        const toneDesc = brief?.creativeStyle?.toneDescription ?? '';
        const mustStayOnTopic = brief?.contentStrategy?.mustStayOnTopic ?? false;
        const noBusinessMetaphors = brief === undefined ? false : !brief.contentStrategy.businessMetaphorsAllowed;
        const audienceDesc = brief?.audience?.description ?? 'LinkedIn professionals';

        // Build the mode-specific instruction block
        const modeBlock = buildModeBlock(approachMode);

        const systemPrompt = `
You are a Content Strategist for a carousel-making AI.

═══════════════════════════════════════════════════════════════════════
INPUT INFORMATION
═══════════════════════════════════════════════════════════════════════
INPUT_TYPE: ${inputType}
AUDIENCE: ${audienceDesc}
TONE: ${toneDesc || (instructions ? `User instruction: ${instructions}` : 'Direct, authoritative')}

INPUT_DATA:
"""
${processedInput}
"""
═══════════════════════════════════════════════════════════════════════

YOUR TASK:
${modeBlock}

CONSTRAINTS:
${mustStayOnTopic ? '- CRITICAL: Stay strictly on the actual topic. Do NOT invent a business metaphor or tangential angle.' : '- You may find a creative angle if it makes the content more engaging.'}
${noBusinessMetaphors ? '- Do NOT use business/LinkedIn metaphors. This is NOT a professional advice carousel.' : ''}
${brief?.contentStrategy?.stayFactuallyAccurate ? '- All facts you reference must be accurate. Do NOT hallucinate statistics or events.' : ''}

OUTPUT REQUIREMENTS:
Return a JSON object with:
- premise: The content spine for this carousel (specific angle / arc / fact sequence / steps).
- audience: Who is this for? (refined from the brief)
- takeaway: The single feeling or insight the reader should leave with.
    `.trim();

        try {
            console.log(`[StrategistAgent] Generating strategy (mode: ${approachMode})...`);
            const result = await generateContentFromAgent(systemPrompt, STRATEGIST_SCHEMA);

            const data = result.viralAngle || result;

            if (!data || !data.premise) {
                throw new Error('Invalid response from Strategist Agent');
            }

            console.log('[StrategistAgent] Generated strategy:', data);

            // Format label depends on mode
            const label = {
                VIRAL_ANGLE: 'VIRAL ANGLE STRATEGY',
                FACTUAL_SPINE: 'CONTENT SPINE (FACTUAL)',
                NARRATIVE_ARC: 'NARRATIVE ARC',
                HOW_TO_STEPS: 'HOW-TO STRUCTURE',
            }[approachMode] ?? 'CONTENT STRATEGY';

            return `
**${label}**:
- **Premise/Hook**: ${data.premise}
- **Target Audience**: ${data.audience}
- **Key Takeaway**: ${data.takeaway}

(Strictly follow this strategy. Do not deviate to generic advice.)
            `.trim();

        } catch (error) {
            console.error('[StrategistAgent] Error:', error);
            console.warn('[StrategistAgent] Falling back to raw input.');
            return `Topic/Context: ${input}\n(Strategist failed, use this raw input directly)`;
        }
    }
};

// ---------------------------------------------------------------------------
// Mode-specific instruction blocks
// ---------------------------------------------------------------------------

function buildModeBlock(mode: string): string {
    switch (mode) {
        case 'FACTUAL_SPINE':
            return `
You are a FACT CURATOR. Your job is to identify the most important, interesting, and
accurate facts about this topic and organise them into a clear educational spine.

- Extract the core facts: what happened, when, why, what was the impact.
- Order them for maximum curiosity and clarity (hook first, depth in the middle, wonder at the end).
- Do NOT invent a LinkedIn business angle. Stay on the actual topic.
- The "premise" field should read like a documentary pitch: 
  e.g. "On 66 million years ago, an asteroid ended the age of dinosaurs in 3 stages: 
  the impact, the nuclear winter, and the extinction cascade — and why 1 lineage survived."
            `.trim();

        case 'NARRATIVE_ARC':
            return `
You are a STORY ARCHITECT. Your job is to find the compelling story arc in this topic.

- Find the hero/protagonist, the conflict/challenge, and the resolution/lesson.
- This could be a personal story, a historical event, or a conceptual journey.
- Structure: Setup (who/what) → Tension (the problem/challenge) → Resolution (the outcome/lesson).
- The "premise" field should describe the full arc in 2-3 sentences.
            `.trim();

        case 'HOW_TO_STEPS':
            return `
You are a TUTORIAL DESIGNER. Your job is to turn this topic into a clear, actionable step-by-step guide.

- Identify the core action or skill the user wants to learn.
- Break it into 4-8 concrete, specific steps (no vague advice).
- Each step should be something the reader can actually do.
- The "premise" field should list the steps as a short numbered sequence.
            `.trim();

        case 'VIRAL_ANGLE':
        default:
            return `
You are a VIRAL CONTENT STRATEGIST for LinkedIn.

- Ignore generic advice. Find a specific, high-stakes, counter-intuitive angle.
- Apply creative tension: a myth to bust, a hidden insight, a surprising contrast.
- The "premise" field should be punchy and specific:
  e.g. "Stop celebrating 5% growth. Retention is killing you."
- If INPUT_TYPE is 'TOPIC': Brainstorm a bold angle from the topic.
- If INPUT_TYPE is 'CONTEXT': Extract the single most interesting insight from the source material.
            `.trim();
    }
}
