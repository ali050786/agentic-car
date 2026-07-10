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
3. STYLE REFERENCES — set "styleReference" ONLY when the user EXPLICITLY names a
   person, creator, or brand to emulate (e.g. they write "in the style of <name>",
   "like <creator>", "<author>'s voice"). If the user did not name anyone, leave
   styleReference EMPTY. NEVER copy an example name from these instructions into
   the brief — the names used here are only illustrations, not defaults. Inventing
   a persona the user never asked for is a bug.
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
10. DEFAULT INVERSION — THIS IS CRITICAL. The safe default is FACTUAL_SPINE, NOT
    VIRAL_ANGLE. Only choose approachMode: "VIRAL_ANGLE" when the user EXPLICITLY
    signals it — words like "LinkedIn", "viral", "for my followers", "hook",
    "thought leadership", "hot take". If those words are absent, do NOT invent a
    viral/business angle. Take the request literally and teach or explain the
    actual subject. When unsure between VIRAL_ANGLE and FACTUAL_SPINE, choose
    FACTUAL_SPINE. A carousel that literally answers the prompt always beats one
    that hijacks it into a LinkedIn lesson.

━━━ WORKED EXAMPLES (match these exactly) ━━━
- "create a carousel for kid teaching about how it rains"
  → contentType: EDUCATIONAL, audience: KIDS, vocabulary: SIMPLE,
    approachMode: FACTUAL_SPINE, businessMetaphorsAllowed: false,
    illustrationMode: LITERAL. topic: "how rain forms (the water cycle)".
    This is NOT about communication skills, simplicity, or LinkedIn — it teaches
    a child how rain actually works.
- "70% of UX jobs vanished — scrutinize how true this is, is the UX/UI market at risk"
  → contentType: EDUCATIONAL, approachMode: FACTUAL_SPINE,
    businessMetaphorsAllowed: false, stayFactuallyAccurate: true.
    This is a fact-check/analysis, NOT a viral LinkedIn hook.

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
- toneDescription: A rich 2-3 sentence description of the voice that FITS THIS TOPIC
  AND AUDIENCE. If (and only if) the user named a creator to emulate, describe that
  creator's voice specifically. If they did not, describe an appropriate voice for the
  subject — do NOT attribute it to any named person the user didn't mention.
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
                const brief = applyIntentGuards(userInput, result.brief as CreativeBrief);
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

            // Fallback: neutral, topic-faithful default (NOT LinkedIn), then guarded.
            console.warn('[CreativeDirectorAgent] Unexpected shape, falling back to NEUTRAL default');
            return { ready: true, brief: applyIntentGuards(userInput, buildNeutralFallback(userInput)) };

        } catch (err) {
            console.error('[CreativeDirectorAgent] Failed, using neutral fallback:', err);
            return { ready: true, brief: applyIntentGuards(userInput, buildNeutralFallback(userInput)) };
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
            if (result.brief) return applyIntentGuards(combinedInput, result.brief as CreativeBrief);
        } catch (err) {
            console.error('[CreativeDirectorAgent] Synthesis failed, using neutral fallback:', err);
        }

        return applyIntentGuards(combinedInput, buildNeutralFallback(originalInput));
    },
};

// ---------------------------------------------------------------------------
// Fallback brief — a NEUTRAL, topic-faithful default used when the classifier
// fails or returns garbage. Deliberately NOT LinkedIn/viral: the old
// PROFESSIONAL+VIRAL_ANGLE fallback was the main reason weak free models
// (e.g. the default gpt-oss-120b) collapsed every prompt into a LinkedIn post.
// A neutral factual default is safe for any topic; applyIntentGuards() then
// specialises it from the actual words in the prompt.
// ---------------------------------------------------------------------------

function buildNeutralFallback(topic: string): CreativeBrief {
    return {
        topic,
        contentType: 'EDUCATIONAL',
        suggestedSlideCount: 7,
        audience: { type: 'GENERAL', description: 'a general audience curious about this topic' },

        creativeStyle: {
            toneDescription: 'Clear, knowledgeable, and genuinely helpful. Explains the actual topic plainly, without hype or jargon.',
            vocabulary: 'CASUAL',
            humorAllowed: false,
            popCultureAllowed: false,
        },
        contentStrategy: {
            approachMode: 'FACTUAL_SPINE',
            mustStayOnTopic: true,
            businessMetaphorsAllowed: false,
            stayFactuallyAccurate: true,
        },
        visualStyle: {
            illustrationMode: 'LITERAL',
            emotionToConvey: 'Informed and curious',
        },
        outputLanguage: 'English',
    };
}

// ---------------------------------------------------------------------------
// Deterministic intent guards (model-agnostic safety net)
//
// The classifier LLM is whatever model the user picked — including the weak
// free default — so we do NOT trust it to honour the nuanced rules above.
// These guards run in code AFTER classification and hard-correct the two
// failure classes we actually see, plus invert the viral default so a LinkedIn
// angle requires an explicit signal. Never forces a model change (that stays
// the user's choice); it just refuses to let intent collapse into "LinkedIn".
// ---------------------------------------------------------------------------

const KID_RE = /\b(for (a |my )?kids?|for (a |my )?child(ren)?|for (a |my )?(son|daughter)|explain (it |this )?to (a |my )?(kid|child|\d+[- ]?year[- ]?old|five|ten)|to a \d+[- ]?year[- ]?old|for (pre)?schoolers?|kindergarten|eli5|like i'?m (5|five))\b/i;
const STUDENT_RE = /\b(for students?|for (high ?school|middle ?school|college|university) (students?|kids?)?|for my class|classroom)\b/i;
const FACTCHECK_RE = /\b(scrutin\w+|how true|is (it|this|that) (really )?true|fact[- ]?check|debunk|verify (this|the|that) claim|myth or fact|is (it|this) a myth|what does the data (say|show)|analy[sz]e whether|is .* really (true|at risk))\b/i;
const VIRAL_SIGNAL_RE = /\b(linkedin|for my followers?|go viral|viral|thought[- ]leadership|hot take|hook|engagement bait|for my audience|for my page)\b/i;

function applyIntentGuards(userInput: string, brief: CreativeBrief): CreativeBrief {
    const input = userInput || '';
    const cs = brief.contentStrategy;
    const vs = brief.visualStyle;

    const isKid = KID_RE.test(input);
    const isStudent = STUDENT_RE.test(input);
    const isFactCheck = FACTCHECK_RE.test(input);
    const hasViralSignal = VIRAL_SIGNAL_RE.test(input);

    // Guard 1 — audience is children/students: this is teaching, never a LinkedIn post.
    if (isKid || isStudent) {
        brief.contentType = 'EDUCATIONAL';
        brief.audience = {
            type: isKid ? 'KIDS' : 'STUDENTS',
            description: isKid ? 'young children being taught this topic' : 'students learning this topic',
        };
        brief.creativeStyle.vocabulary = 'SIMPLE';
        cs.businessMetaphorsAllowed = false;
        cs.mustStayOnTopic = true;
        cs.stayFactuallyAccurate = true;
        // Keep a deliberate story/how-to arc if the model chose one; otherwise teach the facts.
        if (cs.approachMode !== 'NARRATIVE_ARC' && cs.approachMode !== 'HOW_TO_STEPS') {
            cs.approachMode = 'FACTUAL_SPINE';
        }
        // Draw the real subject (or a fun character) — never a business metaphor doodle.
        if (vs.illustrationMode === 'METAPHORICAL') vs.illustrationMode = 'LITERAL';
        console.log('🛡️ [CreativeDirector] Guard: kid/student audience → EDUCATIONAL/SIMPLE/LITERAL, no business metaphors');
    }

    // Guard 2 — fact-check / analytical prompts: evidence, not a viral angle.
    if (isFactCheck) {
        if (brief.contentType !== 'OPINION') brief.contentType = 'EDUCATIONAL';
        cs.approachMode = 'FACTUAL_SPINE';
        cs.businessMetaphorsAllowed = false;
        cs.mustStayOnTopic = true;
        cs.stayFactuallyAccurate = true;
        if (vs.illustrationMode === 'METAPHORICAL') vs.illustrationMode = 'LITERAL';
        console.log('🛡️ [CreativeDirector] Guard: fact-check prompt → FACTUAL_SPINE, accurate, no business metaphors');
    }

    // Guard 3 — invert the viral default: a LinkedIn/viral angle now requires an
    // EXPLICIT signal. Without one, VIRAL_ANGLE drops to a factual spine. This is
    // what stops a weak model defaulting the whole app into "LinkedIn thought leadership".
    if (cs.approachMode === 'VIRAL_ANGLE' && !hasViralSignal) {
        cs.approachMode = 'FACTUAL_SPINE';
        cs.businessMetaphorsAllowed = false;
        console.log('🛡️ [CreativeDirector] Guard: VIRAL_ANGLE with no explicit viral signal → FACTUAL_SPINE');
    }

    // Guard 4 — a named style persona must come from the USER, not from the
    // classifier copying an example name (e.g. "Tanmay Bhat") out of the prompt.
    // buildPersona() turns styleReference into "a writer who adopts the style of X",
    // so an unsolicited value leaks a whole persona the user never asked for. Drop
    // any styleReference whose name does not actually appear in the user's input.
    const ref = brief.creativeStyle.styleReference?.trim();
    if (ref) {
        const firstToken = ref.toLowerCase().split(/\s+/)[0];
        if (firstToken && !input.toLowerCase().includes(firstToken)) {
            console.log(`🛡️ [CreativeDirector] Guard: dropped unsolicited styleReference "${ref}" (user never named it)`);
            brief.creativeStyle.styleReference = undefined;
        }
    }

    return brief;
}

