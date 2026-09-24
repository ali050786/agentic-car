/**
 * Scripted model for offline tests of the v2 pipelines. Answers by call label,
 * deliberately misbehaving the way real models do (over-long fields, invented
 * numbers, banned words, emoji, accent phrases that aren't in the headline,
 * skipped slides) so the tests prove the code-level guarantees hold.
 */

import type { MockLLMRequest } from '../../core/llm/agentGateway';

export interface MockOptions {
    /** Writer skips this 1-based slide on the first attempt. */
    skipSlide?: number;
    /** Planner returns this edit plan for edit tests. */
    editPlan?: any;
    /** Force the gate to refuse. */
    refuse?: boolean;
    /** Force moderation to flag. */
    flagOutput?: boolean;
    /** Critic score for every dimension. */
    criticScore?: number;
    /** Canvas: custom Design Director answer (default: a plausible plan). */
    designDirector?: (prompt: string) => any;
    /** Canvas: custom composer answer per slide (default: the draft plus a sticker and a spark). */
    composer?: (prompt: string, draft: any) => any;
    /** Simulated latency per call, by label prefix (longest matching prefix wins), in ms. */
    delays?: Record<string, number>;
    /** Creative Director brief (worker-side briefing). */
    cdBrief?: any;
    /** Fact-check findings (default: none). */
    factCheck?: any[];
    /** The hook tournament fails. */
    hookFail?: boolean;
}

export interface MockCall { label: string; role: string; prompt: string }

const LONG = 'This sentence is intentionally far too long for any slide field because models love to ramble on and on about the topic at hand without ever stopping to count characters, which is exactly why we validate in code and never trust the prompt alone to do it.';

export const createMockLLM = (opts: MockOptions = {}) => {
    const calls: MockCall[] = [];
    let writerCalls = 0;
    let skippedOnce = false;

    const delayFor = (label: string) => {
        // Writer calls take time in proportion to the slides they write (like real output tokens).
        const perSlide = opts.delays?.['writer.per-slide'];
        const range = label.match(/^writer\.(\d+)-(\d+)$/);
        if (perSlide && range) return perSlide * (Number(range[2]) - Number(range[1]) + 1);
        const keys = Object.keys(opts.delays || {}).filter((k) => label.startsWith(k)).sort((a, b) => b.length - a.length);
        return keys.length ? opts.delays![keys[0]] : 0;
    };

    const fn = async (req: MockLLMRequest): Promise<any> => {
        const p = `${req.systemPrompt || ''}\n${req.prompt}`;
        calls.push({ label: req.label, role: req.role, prompt: p });
        const label = req.label;
        const wait = delayFor(label);
        if (wait) await new Promise((r) => setTimeout(r, wait));

        if (label === 'gatekeeper.classify') {
            return opts.refuse ? { isCarouselRequest: true, unsafeCategory: 'illegal' } : { isCarouselRequest: true, unsafeCategory: 'none' };
        }
        if (label === 'gatekeeper.moderate') return { unsafeCategory: opts.flagOutput ? 'hate' : 'none' };
        if (label === 'research.plan') return { needsResearch: false, reason: 'mock', queries: [] };
        if (label === 'research.facts') {
            return {
                facts: [
                    { text: 'Remote teams that write things down ship 23% faster, per the 2024 GitLab survey.', ref: 'SOURCE' },
                    { text: '"Default to asynchronous communication," said GitLab CEO Sid Sijbrandij.', ref: 'SOURCE' },
                    { text: 'Meetings over 30 minutes lose half their attendees\' attention.', ref: 'SOURCE' },
                ],
            };
        }
        if (label === 'outline') {
            const count = Number(p.match(/Plan EXACTLY (\d+) beats/)?.[1] || 7);
            const kinds = ['hero', 'stat', 'quote', 'list', 'body', 'split', 'body', 'body', 'list', 'body', 'body', 'body'];
            const beats = Array.from({ length: count + 1 }, (_, i) => ({
                blockType: i === count ? 'closing' : kinds[i] || 'body',
                purpose: `purpose ${i + 1}`,
                keyMessage: `Key message number ${i + 1} about async work`,
                factIds: i === 1 ? ['F1'] : i === 2 ? ['f2'] : i === 4 ? ['F99'] : [],
            }));
            // One beat too many on purpose: enforceOutline must trim to the requested count.
            return { premise: 'Async-first teams move faster because writing forces clarity.', takeaway: 'Write it down before you book a meeting.', beats };
        }
        if (label === 'verify') return { problems: opts.factCheck || [] };
        if (label === 'hooks.generate') {
            if (opts.hookFail) throw new Error('hook model down');
            // Scores only when the prompt asks for them (one-call tournament). Hook 1 has the best
            // single score (curiosity 9) but hook 0 wins on the sum: code must add them up.
            const scored = /switch roles/.test(p);
            const sc = (x: any) => (scored ? { scores: x } : {});
            return {
                hooks: [
                    { style: 'specific-promise', preHeader: 'Remote work', headline: 'Ship 23% faster by writing things down', subline: 'The async habits behind the fastest remote teams.', accentPhrase: 'writing things down', ...sc({ specificity: 9, curiosity: 8, clarity: 9, audienceFit: 8, deliverable: 9 }) },
                    { style: 'curiosity-gap', preHeader: 'Remote work', headline: 'Why your best meetings are the ones you cancel', subline: 'A playbook for async-first teams.', accentPhrase: 'NOT IN HEADLINE', ...sc({ specificity: '7', curiosity: 10, clarity: 7, audienceFit: 8, deliverable: 6 }) },
                    { style: 'surprising-fact', preHeader: 'Remote work', headline: LONG.slice(0, 90), subline: 'x', accentPhrase: 'models', ...sc({ specificity: 3, curiosity: 3, clarity: 2, audienceFit: 3, deliverable: 3 }) },
                    { style: 'direct-benefit', preHeader: 'Remote work', headline: 'Get your calendar back', subline: 'Five async habits.', accentPhrase: 'calendar', ...sc({ specificity: 6, curiosity: 6, clarity: 9, audienceFit: 7, deliverable: 8 }) },
                ],
            };
        }
        if (label.startsWith('creativeDirector')) {
            return {
                intentClear: true,
                brief: opts.cdBrief || {
                    topic: 'Async-first remote teams',
                    contentType: 'EDUCATIONAL',
                    suggestedSlideCount: 6,
                    outputLanguage: 'English',
                    audience: { type: 'PROFESSIONAL', description: 'remote team leads' },
                    creativeStyle: { toneDescription: 'direct and practical', vocabulary: 'PROFESSIONAL', humorAllowed: false, popCultureAllowed: false },
                    contentStrategy: { approachMode: 'FACTUAL_SPINE', mustStayOnTopic: true, businessMetaphorsAllowed: true, stayFactuallyAccurate: true },
                    visualStyle: { illustrationMode: 'LITERAL', emotionToConvey: 'confident' },
                },
            };
        }
        if (label === 'hooks.judge') {
            return {
                scores: [
                    { index: 0, specificity: 9, curiosity: 8, clarity: 9, audienceFit: 8, deliverable: 9 },
                    { index: '1', specificity: '7', curiosity: 9, clarity: 7, audienceFit: 8, deliverable: 6 },
                    { index: 2, specificity: 3, curiosity: 3, clarity: 2, audienceFit: 3, deliverable: 3 },
                    { index: 3, specificity: 6, curiosity: 6, clarity: 9, audienceFit: 7, deliverable: 8 },
                ],
                winner: 1, // wrong on purpose: code must sum the scores itself
                reason: 'mock',
            };
        }
        if (label.startsWith('writer.')) {
            writerCalls++;
            const [from, to] = label.replace('writer.', '').split('-').map(Number);
            const blocks = Array.from(p.matchAll(/Slide (\d+) \[(\w+)\]/g)).reduce((m, x) => m.set(Number(x[1]), x[2]), new Map<number, string>());
            const slides: any[] = [];
            for (let i = from; i <= to; i++) {
                // Skipped only the first time a call covers it (calls run in parallel, in any order).
                if (opts.skipSlide === i && !skippedOnce) { skippedOnce = true; continue; }
                const b = blocks.get(i) || 'body';
                const s: any = { index: i, blockType: b, preHeader: `Part ${i}`, headline: `Slide ${i} makes one clear point`, body: `Teh body of slide ${i} explains the point with an example.`, accentPhrase: 'clear point', icon: 'star' };
                if (i === 2) { s.statNumber = '23%'; s.statLabel = 'faster shipping for teams that write things down'; }
                if (i === 3) { s.headline = 'Default to asynchronous communication'; s.quoteAuthor = 'Sid Sijbrandij, GitLab'; }
                if (i === 4) { s.listItems = ['Docs: write the decision first', 'Threads: one topic per thread', 'Video: record instead of meeting', 'Extra: a fourth item']; s.headline = 'Three async habits'; }
                if (i === 5) { s.body = `${LONG} It also claims 87% of managers agree, which is invented. 🚀 Pure synergy.`; }
                if (i === 6) { s.splitLeft = 'Myth: meetings align people'; s.splitRight = 'Fact: documents align people'; s.accentPhrase = 'Totally Different'; }
                if (i === 7) { s.statNumber = '64%'; s.statLabel = 'an invented stat'; s.blockType = 'stat'; }
                slides.push(s);
            }
            return { slides };
        }
        if (label === 'tighten') {
            const fixes = Array.from(p.matchAll(/\[(\d+)\] \(slide \d+, [^)]+\) ([^\n]*)\n([^\n]*)/g)).map((m) => {
                const max = Number(m[2].match(/≤ (\d+)/)?.[1] || 999);
                let text = m[3].replace(/synergy/gi, 'teamwork');
                if (text.length > max) text = text.slice(0, Math.max(10, max - 8)).trim() + ' now';
                return { id: Number(m[1]), text };
            });
            return { fixes };
        }
        if (label === 'critic') {
            const s = opts.criticScore ?? 6;
            const dims = Array.from(p.matchAll(/^- (\w+): /gm)).map((m) => m[1]);
            return {
                dimensions: Object.fromEntries(dims.map((d) => [d, s])),
                slides: [{ index: 5, severity: 'major', problem: 'Generic claim', fix: 'Use a concrete example' }],
                summary: 'mock critique',
            };
        }
        if (label === 'critic.revise') {
            const targets = Array.from(p.matchAll(/^Slide (\d+) \[(\w+)\] \(job:/gm)).map((m) => ({ i: Number(m[1]), b: m[2] }));
            return { slides: targets.map(({ i, b }) => ({ index: i, blockType: b, headline: `Revised slide ${i} with a concrete example`, body: 'A team replaced its daily standup with a written update and got an hour back.', accentPhrase: 'concrete example' })) };
        }
        if (label === 'proofread') {
            const fix = Array.from(p.matchAll(/^S(\d+)\.(\S+): (.*Teh.*)$/gm)).map((m) => ({ slide: Number(m[1]), field: m[2], text: m[3].replace('Teh', 'The') }));
            // One bogus "correction" that rewrites a sentence: must be rejected.
            fix.push({ slide: 1, field: 'body', text: 'A completely different sentence that is much much longer than the original was, which a proofreader should never produce.' });
            return { corrections: fix };
        }
        if (label === 'artDirector') return { prompts: [] };
        if (label === 'design.director') {
            if (opts.designDirector) return opts.designDirector(p);
            // First allowed layout per slide; invert the first quote slide.
            const options = Array.from(p.matchAll(/^(\d+): ([a-z-]+) \(/gm)).map((m) => ({ i: Number(m[1]), id: m[2] }));
            const blocks = Array.from(p.matchAll(/^(\d+) \[(\w+)\]/gm)).map((m) => ({ i: Number(m[1]), b: m[2] }));
            const quote = blocks.find((b) => b.b === 'quote')?.i;
            return {
                direction: 'editorial', fonts: 'classic', radius: 'none', mark: 'serif', headingCase: 'none',
                rationale: 'Serious research topic: editorial serif.',
                slides: options.map((o) => ({ index: o.i, layout: o.id, invert: o.i === quote, idea: `Idea for slide ${o.i}` })),
            };
        }
        if (label === 'design.compose') {
            const raw = p.split('improve it for this content rather than starting over, unless the idea or request calls for something else):\n')[1]?.split('\n')[0] || '{}';
            let draft: any = {};
            try { draft = JSON.parse(raw); } catch { draft = {}; }
            if (opts.composer) return opts.composer(p, draft);
            const root = draft.root || { type: 'stack', children: [] };
            root.children = [{ type: 'text', field: 'x.tag', role: 'label', color: 'accent' }, ...(root.children || [])];
            return { root, bg: draft.bg, decor: [...(draft.decor || []), { shape: 'spark', x: 92, y: 95, w: 5, color: 'accent' }], extras: { tag: 'Worth knowing', bogus: 'Up 900% 🚀' } };
        }
        if (label.startsWith('edit.plan')) return opts.editPlan || { actions: [{ type: 'answer' }], reply: 'Sure.' };
        if (label.startsWith('edit.copy')) {
            const section = p.split('SLIDES TO EDIT:')[1]?.split('LIMITS')[0] || '';
            const targets = Array.from(section.matchAll(/^Slide (\d+) \[(\w+)\](: NEW SLIDE, write it about: (.*))?/gm)).map((m) => ({ i: Number(m[1]), about: m[4] }));
            const slides: any[] = targets.map(({ i, about }) => about
                ? { index: i, headline: `New slide about ${about.slice(0, 20)}`, body: 'Freshly written body for the inserted slide.', accentPhrase: 'New slide' }
                : { index: i, headline: `Punchier slide ${i}`, body: 'Tighter body that now claims 99% success.', accentPhrase: 'Punchier' });
            // Misbehave: also "edit" a slide nobody asked for.
            slides.push({ index: 1, headline: 'Unrequested cover rewrite', body: 'Should be ignored.' });
            return { slides };
        }
        if (label.startsWith('edit.regenerate')) {
            const count = Number(p.match(/EXACTLY (\d+) slides/)?.[1] || 5);
            return { slides: Array.from({ length: count }, (_, k) => ({ index: k + 1, blockType: k === 0 ? 'hero' : k === count - 1 ? 'closing' : 'body', headline: `Regenerated ${k + 1}`, body: 'Fresh body.', preHeader: 'New' })) };
        }
        if (label.startsWith('memory')) return { category: 'tonePrefs', note: 'Prefers a punchy tone' };
        return {};
    };
    return { fn, calls };
};
