/**
 * Sample decks for Canvas previews and tests: every block type, short and
 * long copy, keyed and plain list items, percentages and plain numbers.
 */

export interface SampleSlide {
    blockType: string;
    slots: Record<string, any>;
    visual?: { icon?: string; doodleUrl?: string };
}

export interface SampleDeck {
    id: string;
    title: string;
    slides: SampleSlide[];
}

export const SAMPLE_DECKS: SampleDeck[] = [
    {
        id: 'interview',
        title: 'System design interview in 2 weeks',
        slides: [
            { blockType: 'hero', slots: { preHeader: 'System design in 14 days', headline: 'Crush your system design interview with a plan', accentPhrase: 'with a plan', body: 'Days 1–13: concepts, a framework and timed practice. Day 14: rest.' }, visual: { icon: 'Target' } },
            { blockType: 'body', slots: { preHeader: 'Days 1–3 · Foundation', headline: 'Master the core distributed systems ideas', accentPhrase: 'core', body: 'CAP theorem, sharding, caching, load balancing and consistency models. Clear definitions and trade-offs, no deep dives yet.' }, visual: { icon: 'Layers' } },
            { blockType: 'list', slots: { preHeader: 'Days 4–8 · Practice', headline: 'Solve three classic problems', accentPhrase: 'classic', listItems: ['URL shortener: key generation, redirects and storage', 'Chat system: real-time delivery, presence and scale', 'News feed: ranking, fan-out and caching'] }, visual: { icon: 'Package' } },
            { blockType: 'stat', slots: { preHeader: 'Pacing', headline: 'Finish the full framework inside the interview slot', statNumber: '45 min', statLabel: 'to go from requirements to bottlenecks' }, visual: { icon: 'Clock' } },
            { blockType: 'quote', slots: { headline: 'Interviewers judge your reasoning, not a single perfect design', quoteAuthor: 'Staff engineer, FAANG' }, visual: {} },
            { blockType: 'split', slots: { preHeader: 'Days 11–13', headline: 'Mock interviews change everything', accentPhrase: 'change everything', splitLeft: 'Before: rambling, missed requirements, no time left for scale', splitRight: 'After: a crisp 45-minute flow with trade-offs stated out loud' }, visual: {} },
            { blockType: 'closing', slots: { preHeader: 'Day 14', headline: 'Review your notes, then rest', accentPhrase: 'rest', body: 'You put in the work. Walk in with a framework you trust.', footer: 'Save this plan' }, visual: { icon: 'Rocket' } },
        ],
    },
    {
        id: 'fourday',
        title: 'The UK four-day week trial',
        slides: [
            { blockType: 'hero', slots: { preHeader: 'UK pilot · 2022', headline: '61 companies tried a four-day week. 56 kept it.', accentPhrase: '56 kept it', body: 'What six months of 32-hour weeks did to revenue, burnout and staff turnover.' }, visual: { icon: 'Calendar' } },
            { blockType: 'stat', slots: { preHeader: 'Retention', headline: 'People stopped leaving', statNumber: '57%', statLabel: 'fewer staff left during the trial' }, visual: { icon: 'Users' } },
            { blockType: 'stat', slots: { preHeader: 'Wellbeing', headline: 'Burnout dropped across the board', statNumber: '71%', statLabel: 'of employees reported lower burnout' }, visual: { icon: 'Heart' } },
            { blockType: 'list', slots: { preHeader: 'What worked', headline: 'How the winners did it', accentPhrase: 'winners', listItems: ['Cut meetings: low-value meetings went first', 'Redesign work: processes changed before day one', 'Cover customers: staggered days off kept service open', 'Measure: revenue stayed flat, up 1.4% on average'] }, visual: { icon: 'CheckCircle' } },
            { blockType: 'body', slots: { preHeader: 'The caveat', headline: 'Volunteers are not the average company', accentPhrase: 'not the average', body: 'Firms opted in, so they were likely better suited to the change. Customer-facing teams struggled with coverage and needed rota changes midway.' }, visual: { icon: 'AlertCircle' } },
            { blockType: 'closing', slots: { preHeader: 'Takeaway', headline: 'Fewer hours works when the work changes first', accentPhrase: 'the work changes', body: 'Redesign processes before you compress the week.', footer: 'Share with your team' }, visual: { icon: 'Lightbulb' } },
        ],
    },
    {
        id: 'rain',
        title: 'How rain forms',
        slides: [
            { blockType: 'hero', slots: { preHeader: 'The water cycle', headline: 'Where does rain come from?', accentPhrase: 'rain', body: 'A tiny drop takes a giant trip. Let’s follow it!' }, visual: { icon: 'CloudRain' } },
            { blockType: 'body', slots: { preHeader: 'Step 1', headline: 'The sun makes water float', accentPhrase: 'float', body: 'The sun warms puddles, rivers and oceans. The water turns into invisible vapor and rises into the sky.' }, visual: { icon: 'Sun' } },
            { blockType: 'list', slots: { preHeader: 'Step 2', headline: 'Clouds are made of drops', accentPhrase: 'drops', listItems: ['Cool air', 'Tiny drops', 'Big clouds'] }, visual: { icon: 'Cloud' } },
            { blockType: 'body', slots: { preHeader: 'Step 3', headline: 'Too heavy? Down it comes!', accentPhrase: 'Down it comes', body: 'When a cloud holds too many drops, they fall as rain.' }, visual: { icon: 'Droplets' } },
            { blockType: 'closing', slots: { preHeader: 'The big idea', headline: 'Rain goes round and round', accentPhrase: 'round and round', body: 'From the sky to the sea and back up again.', footer: 'Try the jar experiment' }, visual: { icon: 'Rainbow' } },
        ],
    },
];
