/**
 * Creative Director Agent
 *
 * The first agent in the pipeline. It reads the user's raw free-form input
 * and either:
 *   A) Produces a complete CreativeBrief immediately (when intent is clear), OR
 *   B) Returns clarifying questions + quick-reply chips to ask the user (when
 *      intent is ambiguous), then synthesises the brief once answers come in.
 *
 * This replaces the hardcoded "LinkedIn Ghostwriter" assumption baked into
 * every downstream agent. The brief it produces governs tone, persona,
 * illustration style, and whether the Strategist should generate a viral angle
 * or a factual/narrative spine instead.
 */

import { generateContentFromAgent } from '../../services/aiService';
import { CreativeBrief, QuickReplyChip } from '../../types';

// ---------------------------------------------------------------------------
// Schema: Turn 1 — Intent Analysis
// ---------------------------------------------------------------------------

const INTENT_ANALYSIS_SCHEMA = {
    type: 'object',
    properties: {
        intentClear: {
            type: 'boolean',
            description: 'True if the prompt provides enough context to produce a brief without asking the user anything.'
        },
        brief: {
            type: 'object',
            description: 'Populated only when intentClear is true.',
            properties: {
                topic: { type: 'string' },
                suggestedSlideCount: {
                    type: 'number',
                    description: 'Optimal number of slides. Hard bounds: min 2, max 20. Simple/punchy = 5-6. Standard = 7. Educational/complex = 8-10. Cap user requests at 20 and floor at 2.'
                },
                outputLanguage: {
                    type: 'string',
                    description: 'The language for generating the final carousel text. ALWAYS detect the language of the prompt or any explicit language requests (e.g. Spanish, German, French, Portuguese, Hindi, English). Defaults to "English".'
                },
                slideCountNote: {

                    type: 'string',
                    description: 'Only populate when the user explicitly requested a slide count that was out of bounds. E.g. if they asked for 1: "Minimum is 2 slides — generating 2.". If they asked for 25: "Maximum allowed is 20 slides — I\'ll generate 20 for you."'
                },
                contentType: {
                    type: 'string',
                    enum: ['EDUCATIONAL', 'ENTERTAINMENT', 'EDUTAINMENT', 'PROFESSIONAL', 'STORYTELLING', 'HOW_TO', 'OPINION']
                },
                audience: {
                    type: 'object',
                    properties: {
                        type: { type: 'string', enum: ['GENERAL', 'KIDS', 'STUDENTS', 'PROFESSIONALS', 'NICHE'] },
                        description: { type: 'string' }
                    },
                    required: ['type', 'description']
                },
                creativeStyle: {
                    type: 'object',
                    properties: {
                        styleReference: { type: 'string' },
                        toneDescription: { type: 'string' },
                        vocabulary: { type: 'string', enum: ['SIMPLE', 'CASUAL', 'PROFESSIONAL', 'ACADEMIC'] },
                        humorAllowed: { type: 'boolean' },
                        popCultureAllowed: { type: 'boolean' }
                    },
                    required: ['toneDescription', 'vocabulary', 'humorAllowed', 'popCultureAllowed']
                },
                contentStrategy: {
                    type: 'object',
                    properties: {
                        approachMode: { type: 'string', enum: ['VIRAL_ANGLE', 'FACTUAL_SPINE', 'NARRATIVE_ARC', 'HOW_TO_STEPS'] },
                        mustStayOnTopic: { type: 'boolean' },
                        businessMetaphorsAllowed: { type: 'boolean' },
                        stayFactuallyAccurate: { type: 'boolean' }
                    },
                    required: ['approachMode', 'mustStayOnTopic', 'businessMetaphorsAllowed', 'stayFactuallyAccurate']
                },
                visualStyle: {
                    type: 'object',
                    properties: {
                        illustrationMode: { type: 'string', enum: ['LITERAL', 'METAPHORICAL', 'CHARACTER'] },
                        emotionToConvey: { type: 'string' }
                    },
                    required: ['illustrationMode', 'emotionToConvey']
                }
            },
            required: ['topic', 'contentType', 'suggestedSlideCount', 'outputLanguage', 'audience', 'creativeStyle', 'contentStrategy', 'visualStyle']


        },
        clarifyingMessage: {
            type: 'string',
            description: 'Populated only when intentClear is false. Short friendly message to show the user before the question chips.'
        },
        questionGroups: {
            type: 'array',
            description: 'Populated only when intentClear is false. Max 2 groups.',
            items: {
                type: 'object',
                properties: {
                    question: { type: 'string' },
                    multiSelect: { type: 'boolean' },
                    chips: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                label: { type: 'string' },
                                value: { type: 'string' }
                            },
                            required: ['label', 'value']
                        }
                    }
                },
                required: ['question', 'chips']
            }
        }
    },
    required: ['intentClear']
};

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

const buildAnalysisPrompt = (userInput: string): string => `
You are the Creative Director of a carousel-making AI. Your job is to understand
the user's intent from their free-form input — before any slide is written.

USER INPUT:
"""
${userInput}
"""

TASK:
Analyse the input and decide one of two outcomes:

━━━ OUTCOME A — INTENT IS CLEAR ━━━
The input tells you enough to produce a complete creative brief. This is the
case when you can confidently answer: topic, audience, desired tone/style.

Examples of clear prompts:
- "Dinosaur extinction in Tanmay Bhat style for a general audience"
- "5 steps to close a Series A, for startup founders, keep it direct"
- "Explain photosynthesis to kids, fun and simple"
- "Why stoicism changed my life" (personal story → STORYTELLING is safe)

Set intentClear: true and populate the "brief" object.

━━━ OUTCOME B — INTENT IS AMBIGUOUS ━━━
The input is short and could be interpreted very differently.

Examples of ambiguous prompts:
- "Dinosaurs" (who for? what angle? education or metaphor?)
- "Leadership" (factual? LinkedIn? personal story? kids?)
- "Climate change" (scientific explainer? opinion? business lesson?)

Set intentClear: false. Write a short friendly "clarifyingMessage" and produce
1-2 "questionGroups" with clickable chip options. Max 4 chips per group.

━━━ DECISION RULES ━━━
1. Lean towards OUTCOME A — only ask when genuinely ambiguous.
2. NEVER default to LinkedIn/professional framing. Factual topics like science,
   history, and nature default to EDUCATIONAL unless the user signals otherwise.
3. "Style references" like "Tanmay Bhat", "Ali Abdaal", "Paul Graham" are
   strong signals — use them to populate toneDescription precisely.
4. If the user says "for kids", "for students", or "explain to my [family member]" →
   that's EDUCATIONAL + KIDS/STUDENTS + SIMPLE vocabulary.
5. Only set approachMode: "VIRAL_ANGLE" when the user clearly wants LinkedIn-style
   thought leadership (they say "LinkedIn", "for my followers", "viral", "hook", etc.)
   OR the topic is inherently professional advice with no analytical/fact-check component.
6. businessMetaphorsAllowed: false for all EDUCATIONAL and ENTERTAINMENT content.
7. illustrationMode:
   - LITERAL for EDUCATIONAL (draw actual subjects — dinosaurs, asteroids, molecules)
   - CHARACTER for EDUTAINMENT / ENTERTAINMENT (expressive fun cartoon scenes)
   - METAPHORICAL for PROFESSIONAL (current business metaphor behavior)
8. FACT-CHECK / ANALYTICAL prompts: If the user uses phrases like "scrutinize",
   "fact-check", "how true is", "is this really true", "analyze whether", "debunk",
   "verify this claim", "what does the data say" → ALWAYS use contentType: EDUCATIONAL
   and approachMode: FACTUAL_SPINE. These are NOT viral/LinkedIn prompts.
   businessMetaphorsAllowed: false. stayFactuallyAccurate: true.
   toneDescription: "Analytical, authoritative, evidence-based. Presents data
   clearly without hype. Challenges claims with real numbers."
9. CAREER ADVICE prompts: If the user asks about job market, salary, career moves,
   "what should I do" about a professional situation → contentType: OPINION,
   approachMode: FACTUAL_SPINE (evidence-based opinion, not viral angle),
   vocabulary: PROFESSIONAL. businessMetaphorsAllowed: false — write plainly
   for the real professional, not for a LinkedIn performance.


SLIDE COUNT GUIDANCE (populate suggestedSlideCount in the brief):
- Absolute minimum: 2 slides. Absolute maximum: 20 slides.
- 2-4 slides: User explicitly wants very few slides (e.g. "2 slides", "super short")
- 5-6 slides: Simple, punchy opinion or single insight
- 7 slides: Default for most topics
- 8-9 slides: Multi-step how-to or moderately complex topic
- 10+ slides: Rich educational content (history, science, deep-dive)
- 20 slides: Maximum — only if user explicitly requests it
- If the user requests FEWER than 2 slides: set suggestedSlideCount=2 and populate
  slideCountNote with a friendly message: "Minimum is 2 slides — generating 2 for you."
- If the user requests MORE than 20 slides: set suggestedSlideCount=20 and populate
  slideCountNote: "Maximum allowed is 20 slides — I'll generate 20 for you and we can refine from there!"
- If no count is specified: choose naturally based on content type.

LANGUAGE DETECTION:
- Default is "English".
- Inspect the prompt carefully. If the prompt is written in another language (e.g. Spanish: "crea un carrusel sobre...", French: "créer un carrousel...", German, Hindi, Portuguese, etc.) or explicitly requests a language (e.g. "make it in Spanish"), set "outputLanguage" to that language.
- Set outputLanguage to the exact language name capitalized (e.g., "Spanish", "French", "German", "Portuguese", "Hindi", "English").

BRIEF FIELD GUIDANCE:

- topic: The actual subject matter in plain language (e.g. "why dinosaurs went extinct 66M years ago")
- toneDescription: A rich 2-3 sentence description of the voice. For style references,
  be specific: "Tanmay Bhat's style: irreverent comedy with genuine curiosity, punchy
  one-liners, absurdist comparisons to everyday life, casual Indian-English, self-aware humor."
- emotionToConvey: What feeling should a reader have after the last slide?

Return JSON matching the schema exactly.
`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ClarifyingQuestions {
    message: string;
    groups: Array<{
        question: string;
        multiSelect?: boolean;
        chips: QuickReplyChip[];
    }>;
}

export type IntentAnalysisResult =
    | { ready: true; brief: CreativeBrief }
    | { ready: false; questions: ClarifyingQuestions };

export const CreativeDirectorAgent = {
    /**
     * Turn 1: Analyse the user's raw prompt.
     * Returns either a complete brief (ready: true) or clarifying questions
     * (ready: false) that the ChatPanel should present to the user.
     */
    analyseIntent: async (userInput: string): Promise<IntentAnalysisResult> => {
        console.log('🎬 [CreativeDirectorAgent] Analysing intent for:', userInput.substring(0, 80));

        const prompt = buildAnalysisPrompt(userInput);

        try {
            const result = await generateContentFromAgent(prompt, INTENT_ANALYSIS_SCHEMA);

            if (result.intentClear && result.brief) {
                const brief = result.brief as CreativeBrief;
                // Server-side clamp: enforce hard bounds regardless of model output
                if (typeof brief.suggestedSlideCount === 'number') {
                    brief.suggestedSlideCount = Math.max(2, Math.min(20, brief.suggestedSlideCount));
                }
                console.log('🎬 [CreativeDirectorAgent] Intent clear →', brief.contentType, brief.contentStrategy.approachMode, `${brief.suggestedSlideCount} slides`);
                return { ready: true, brief };
            }

            if (!result.intentClear && result.questionGroups?.length) {
                console.log('🎬 [CreativeDirectorAgent] Intent ambiguous → asking', result.questionGroups.length, 'question(s)');
                return {
                    ready: false,
                    questions: {
                        message: result.clarifyingMessage || 'Quick question before I start:',
                        groups: result.questionGroups,
                    },
                };
            }

            // Fallback: treat as clear professional intent (preserves old behaviour)
            console.warn('[CreativeDirectorAgent] Unexpected shape, falling back to PROFESSIONAL default');
            return { ready: true, brief: buildProfessionalFallback(userInput) };

        } catch (err) {
            console.error('[CreativeDirectorAgent] Failed, using professional fallback:', err);
            return { ready: true, brief: buildProfessionalFallback(userInput) };
        }
    },

    /**
     * Turn 2: Synthesise the final brief from the original prompt + the user's
     * answers to the clarifying questions.
     */
    synthesiseBrief: async (
        originalInput: string,
        userAnswers: string
    ): Promise<CreativeBrief> => {
        console.log('🎬 [CreativeDirectorAgent] Synthesising brief from answers...');

        const combinedInput = `${originalInput}\n\nUser clarifications: ${userAnswers}`;
        const prompt = buildAnalysisPrompt(combinedInput);

        try {
            const result = await generateContentFromAgent(prompt, INTENT_ANALYSIS_SCHEMA);
            if (result.brief) return result.brief as CreativeBrief;
        } catch (err) {
            console.error('[CreativeDirectorAgent] Synthesis failed, using professional fallback:', err);
        }

        return buildProfessionalFallback(originalInput);
    },
};

// ---------------------------------------------------------------------------
// Fallback brief — preserves current LinkedIn behaviour if the agent fails
// ---------------------------------------------------------------------------

function buildProfessionalFallback(topic: string): CreativeBrief {
    return {
        topic,
        contentType: 'PROFESSIONAL',
        suggestedSlideCount: 7,
        audience: { type: 'PROFESSIONALS', description: 'LinkedIn professionals' },

        creativeStyle: {
            toneDescription: 'Direct, authoritative, LinkedIn thought leadership. Bold declarative statements.',
            vocabulary: 'PROFESSIONAL',
            humorAllowed: false,
            popCultureAllowed: false,
        },
        contentStrategy: {
            approachMode: 'VIRAL_ANGLE',
            mustStayOnTopic: false,
            businessMetaphorsAllowed: true,
            stayFactuallyAccurate: false,
        },
        visualStyle: {
            illustrationMode: 'METAPHORICAL',
            emotionToConvey: 'Inspired, motivated, informed',
        },
        outputLanguage: 'English',
    };
}

