/**
 * Golden set for pipeline evals. Each case fixes the brief (so v1 and v2 get
 * identical instructions and the Creative Director's variance is out of the
 * comparison) and covers a different content type, template, language or
 * input mode.
 */

import type { CreativeBrief, TemplateId } from '../types';
import { defaultBrief } from '../core/agents/v2/createPipeline';

export interface GoldenCase {
    id: string;
    topic: string;
    template: TemplateId;
    slides: number;
    sourceContent?: string;
    brief: CreativeBrief;
    /** What a good deck must do (shown to the judge). */
    expectations: string;
}

const brief = (topic: string, count: number, patch: Partial<CreativeBrief> & { tone?: string; who?: string; audienceType?: CreativeBrief['audience']['type']; approach?: CreativeBrief['contentStrategy']['approachMode']; accurate?: boolean; humor?: boolean; vocabulary?: CreativeBrief['creativeStyle']['vocabulary'] } = {}): CreativeBrief => {
    const b = defaultBrief(topic, patch.outputLanguage || 'English', count);
    return {
        ...b,
        contentType: patch.contentType || b.contentType,
        audience: { type: patch.audienceType || b.audience.type, description: patch.who || b.audience.description },
        creativeStyle: { ...b.creativeStyle, toneDescription: patch.tone || b.creativeStyle.toneDescription, humorAllowed: patch.humor ?? b.creativeStyle.humorAllowed, vocabulary: patch.vocabulary || b.creativeStyle.vocabulary },
        contentStrategy: { ...b.contentStrategy, approachMode: patch.approach || b.contentStrategy.approachMode, stayFactuallyAccurate: patch.accurate ?? b.contentStrategy.stayFactuallyAccurate, businessMetaphorsAllowed: patch.contentType === 'PROFESSIONAL' },
        outputLanguage: patch.outputLanguage || 'English',
    };
};

const FOUR_DAY_WEEK = `In 2022, 61 UK companies took part in a six-month four-day week pilot run by the non-profit 4 Day Week Global with researchers from Cambridge and Boston College. Around 2,900 employees moved to a 32-hour week with no loss of pay.
At the end, 56 of the 61 companies said they would continue with the four-day week, and 18 made it permanent. Revenue stayed broadly the same over the trial period, rising 1.4% on average across the companies that shared data. Compared with the same period a year earlier, revenue grew 35%.
The number of staff leaving fell by 57%. Sick days dropped by about two-thirds. 39% of employees said they were less stressed, and 71% reported lower levels of burnout by the end of the trial.
Companies used different models: some gave everyone Fridays off, others staggered days so customers were always covered, and a few used an annualised 32-hour average. The organisers said the biggest predictor of success was cutting low-value meetings and redesigning processes before the trial started, not just compressing five days into four.
Critics note that participating companies volunteered, so they were likely better suited to the change than average, and that the trial was short. Several firms in customer-facing sectors struggled with coverage and needed rota changes midway.`;

export const GOLDEN_SET: GoldenCase[] = [
    {
        id: 'kids-rain',
        topic: 'Explain how rain forms, for 8 year olds',
        template: 'template-1',
        slides: 6,
        brief: brief('how rain forms (the water cycle)', 6, { audienceType: 'KIDS', who: 'curious 8 year olds', vocabulary: 'SIMPLE', tone: 'Warm, playful and very simple. Short sentences a child can read aloud.' }),
        expectations: 'Teaches the water cycle correctly in simple words; no business metaphors; no invented statistics.',
    },
    {
        id: 'howto-interview',
        topic: 'How to prepare for a system design interview in 2 weeks',
        template: 'template-4',
        slides: 7,
        brief: brief('a 2-week system design interview prep plan', 7, { contentType: 'HOW_TO', approach: 'HOW_TO_STEPS', who: 'software engineers with an interview in two weeks', vocabulary: 'PROFESSIONAL', tone: 'Direct, practical, coach-like.' }),
        expectations: 'Concrete, ordered steps someone can follow day by day; specific resources or exercises; not generic advice.',
    },
    {
        id: 'linkedin-pitch',
        topic: 'LinkedIn hot take: why most startup pitch decks fail',
        template: 'template-1',
        slides: 8,
        brief: brief('why most startup pitch decks fail', 8, { contentType: 'PROFESSIONAL', approach: 'VIRAL_ANGLE', who: 'early-stage founders on LinkedIn', vocabulary: 'PROFESSIONAL', tone: 'Confident, contrarian, specific. Opinionated but fair.', accurate: false }),
        expectations: 'A sharp, specific angle with a strong hook; each slide pays it off; ends with a clear takeaway; no fake statistics.',
    },
    {
        id: 'factcheck-brain',
        topic: 'Is it true we only use 10% of our brains? Fact-check it',
        template: 'template-1',
        slides: 6,
        brief: brief('fact-check: do we only use 10% of our brains?', 6, { tone: 'Analytical, evidence-based, no hype.', accurate: true }),
        expectations: 'Clearly debunks the myth with correct evidence (imaging shows activity across the brain); no fabricated studies or numbers.',
    },
    {
        id: 'story-airbnb',
        topic: 'The story of how Airbnb survived by selling cereal',
        template: 'template-3',
        slides: 7,
        brief: brief('how Airbnb survived 2008 by selling cereal boxes', 7, { contentType: 'STORYTELLING', approach: 'NARRATIVE_ARC', who: 'founders and startup fans', tone: 'Narrative, vivid, lightly humorous.', humor: true }),
        expectations: 'A real story arc (setup, struggle, turning point, lesson) with accurate details (Obama O\'s / Cap\'n McCain\'s cereal).',
    },
    {
        id: 'fun-zoom',
        topic: 'Funny carousel: the types of people in every Zoom meeting',
        template: 'template-3',
        slides: 6,
        brief: brief('the types of people in every Zoom meeting', 6, { contentType: 'ENTERTAINMENT', approach: 'VIRAL_ANGLE', who: 'remote workers', tone: 'Playful, observational, relatable.', humor: true, accurate: false }),
        expectations: 'Actually funny and recognisable; one archetype per slide; no statistics.',
    },
    {
        id: 'source-4day',
        topic: 'Turn this article into a carousel about the UK four-day week trial',
        template: 'template-1',
        slides: 7,
        sourceContent: FOUR_DAY_WEEK,
        brief: brief('results of the 2022 UK four-day week pilot', 7, { who: 'managers and HR leaders', vocabulary: 'PROFESSIONAL', tone: 'Clear, balanced, data-led.', accurate: true }),
        expectations: 'Uses the article\'s real numbers accurately (61 companies, 56 continued, 57% fewer leavers, 71% less burnout) and includes the caveats.',
    },
    {
        id: 'es-sleep',
        topic: 'Crea un carrusel sobre hábitos de sueño para estudiantes universitarios',
        template: 'template-4',
        slides: 6,
        brief: brief('hábitos de sueño para estudiantes universitarios', 6, { outputLanguage: 'Spanish', contentType: 'HOW_TO', approach: 'HOW_TO_STEPS', audienceType: 'STUDENTS', who: 'estudiantes universitarios', tone: 'Cercano, práctico y motivador.' }),
        expectations: 'Entirely in Spanish; practical habits; no invented statistics.',
    },
    {
        id: 'opinion-remote',
        topic: 'Remote work is better for deep work than offices. Argue it with nuance',
        template: 'template-4',
        slides: 7,
        brief: brief('remote work is better for deep work than offices', 7, { contentType: 'OPINION', who: 'knowledge workers and managers', vocabulary: 'PROFESSIONAL', tone: 'Thoughtful, persuasive, fair to the other side.', accurate: false }),
        expectations: 'Makes a clear argument, acknowledges counterpoints, no fake data.',
    },
    {
        id: 'deep-transformers',
        topic: 'A 12 slide deep dive on how transformer models work',
        template: 'template-1',
        slides: 12,
        brief: brief('how transformer language models work', 12, { who: 'developers new to machine learning', vocabulary: 'PROFESSIONAL', tone: 'Clear, precise, builds intuition step by step.' }),
        expectations: 'Correct explanation (tokens, embeddings, attention, layers, training, next-token prediction) in a logical order; exactly 12 slides.',
    },
];
