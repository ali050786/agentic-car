/**
 * Research → numbered fact sheet.
 *
 * v1 had three layers deciding whether to research (the brief, a PLAN call and
 * ResearchAgent.analyzeInputNeeds), pasted raw search text into the prompt and
 * threw the sources away. v2 makes one decision, searches, and distills a
 * numbered fact sheet (F1…Fn) with source links. Writers cite facts by id, and
 * the grounding check treats the sheet as ground truth.
 */

import type { CreativeBrief } from '../../../types';
import type { Fact, SourceRef } from './types';
import { ask, untrusted } from './prompting';
import { isCancel } from '../../llm/cancel';

/** "How X works" / "explain X": stable knowledge the model already has; search results only pull in trivia. */
const EXPLAINER_RE = /\b(how (?:do|does|did|can|is|are) .{1,80}\b(?:work|works|form|forms|happen|happens|made|built)|how .{1,60}\bworks?\b|explain(?:ed|s|ing)?\b|explainer|what (?:is|are) (?:a |an |the )?\w+|deep[- ]dive|walk ?through|for (?:kids|beginners|dummies|\d+[- ]year[- ]olds?))/i;
/** Signals that the user wants current or quantitative data, so search is still worth it. */
const WANTS_DATA_RE = /\b(19|20)\d{2}\b|\b(latest|current|today|now|this year|recent|trends?|news|price|prices|cost|costs|statistics?|stats|data|numbers|market|benchmarks?|compare|comparison|vs\.?|versus|study|studies|research)\b/i;

/** An explainer of stable knowledge: no search, and the outline walks through the mechanism. */
export const isExplainer = (topic: string): boolean => EXPLAINER_RE.test(topic) && !WANTS_DATA_RE.test(topic);

const FACTCHECK_RE = /\b(scrutin\w+|how true|is (it|this|that) (really )?true|fact[- ]?check|debunk|verify|myth|what does the data)\b/i;

const PLAN_SCHEMA = {
    type: 'object',
    properties: {
        needsResearch: { type: 'boolean' },
        reason: { type: 'string' },
        queries: { type: 'array', items: { type: 'string' } },
    },
    required: ['needsResearch', 'queries'],
};

export interface ResearchPlan {
    needsResearch: boolean;
    reason: string;
    queries: string[];
}

const tavilyKey = (): string | undefined => {
    try {
        return (import.meta as any).env?.VITE_TAVILY_API_KEY || process.env.TAVILY_API_KEY || process.env.VITE_TAVILY_API_KEY;
    } catch {
        return process.env.TAVILY_API_KEY || process.env.VITE_TAVILY_API_KEY;
    }
};

/** One decision, cheapest first: deterministic rules, then a single fast call. */
export const planResearch = async (topic: string, sourceContent: string, brief: CreativeBrief): Promise<ResearchPlan> => {
    if (!tavilyKey()) return { needsResearch: false, reason: 'No search key configured', queries: [] };
    const isFactCheck = FACTCHECK_RE.test(topic);
    // A substantial source IS the material, unless the user asked us to check it.
    if (sourceContent.length >= 1500 && !isFactCheck) return { needsResearch: false, reason: 'Source material provided', queries: [] };
    if (brief.contentType === 'ENTERTAINMENT' && !brief.contentStrategy?.stayFactuallyAccurate) {
        return { needsResearch: false, reason: 'Entertainment content', queries: [] };
    }
    if (!isFactCheck && !sourceContent.trim() && isExplainer(topic)) {
        return { needsResearch: false, reason: 'Explainer of stable knowledge', queries: [] };
    }

    const prompt = `Decide whether a carousel on this subject needs a quick web search for current, specific facts (numbers, dates, examples) before writing.

${untrusted('request', topic, 1500)}
${sourceContent ? untrusted('source_excerpt', sourceContent, 1500) : ''}
Audience: ${brief.audience?.description}. Content type: ${brief.contentType}. ${isFactCheck ? 'The user wants a claim checked, so research is required.' : ''}

Rules:
- needsResearch = true when the carousel would be stronger or more accurate with concrete, verifiable facts, or the subject is time-sensitive.
- needsResearch = false for opinion, personal story, pure how-to from general knowledge, or when the source already covers it.
- queries: 2-3 specific search queries (not the topic verbatim). Include the current year for time-sensitive subjects: ${new Date().getFullYear()}.

Return JSON: { "needsResearch": boolean, "reason": string, "queries": string[] }`;

    try {
        const r = await ask<ResearchPlan>({ role: 'fast', label: 'research.plan' }, prompt, PLAN_SCHEMA);
        const queries = (r.queries || []).map((q) => String(q).trim()).filter(Boolean).slice(0, 3);
        return { needsResearch: (!!r.needsResearch || isFactCheck) && queries.length > 0, reason: r.reason || '', queries };
    } catch (err) {
        if (isCancel(err)) throw err;
        console.warn('[v2.research] plan failed, skipping research:', err);
        return { needsResearch: false, reason: 'planner failed', queries: [] };
    }
};

interface SearchHit { title: string; url: string; content: string }
export interface SearchResult { query: string; answer?: string; hits: SearchHit[] }

export const runSearch = async (queries: string[], deep: boolean): Promise<SearchResult[]> => {
    const key = tavilyKey();
    if (!key || !queries.length) return [];
    const one = async (query: string): Promise<SearchResult | null> => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 25_000);
        try {
            const res = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                signal: controller.signal,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: key, query, include_answer: true, search_depth: deep ? 'advanced' : 'basic', max_results: 5 }),
            });
            if (!res.ok) throw new Error(`Tavily ${res.status}`);
            const data: any = await res.json();
            return {
                query,
                answer: data.answer,
                hits: (data.results || []).slice(0, 5).map((r: any) => ({ title: String(r.title || '').slice(0, 140), url: String(r.url || ''), content: String(r.content || '').slice(0, 900) })),
            };
        } catch (err) {
            if (isCancel(err)) throw err;
            console.warn(`[v2.research] search failed for "${query}":`, err);
            return null;
        } finally {
            clearTimeout(timer);
        }
    };
    return (await Promise.all(queries.map(one))).filter(Boolean) as SearchResult[];
};

const FACTS_SCHEMA = {
    type: 'object',
    properties: {
        facts: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    text: { type: 'string' },
                    ref: { type: 'string' },
                },
                required: ['text', 'ref'],
            },
        },
    },
    required: ['facts'],
};

/**
 * Distills atomic facts from the source and search results. Every fact must be
 * stated in the material; `ref` points at where (SOURCE or R1…Rn).
 */
export const buildFactSheet = async (params: {
    topic: string;
    sourceContent: string;
    results: SearchResult[];
    maxFacts?: number;
}): Promise<{ facts: Fact[]; sources: SourceRef[] }> => {
    const { topic, sourceContent, results } = params;
    const maxFacts = params.maxFacts ?? 12;
    const refs: { id: string; title: string; url: string; text: string }[] = [];
    results.forEach((r) => {
        if (r.answer) refs.push({ id: `R${refs.length + 1}`, title: `Search summary: ${r.query}`, url: r.hits[0]?.url || '', text: r.answer });
        r.hits.forEach((h) => refs.push({ id: `R${refs.length + 1}`, title: h.title, url: h.url, text: h.content }));
    });
    if (!sourceContent.trim() && refs.length === 0) return { facts: [], sources: [] };

    const material = [
        sourceContent.trim() ? untrusted('SOURCE', sourceContent, 12000) : '',
        refs.length ? `SEARCH RESULTS:\n${refs.map((r) => `[${r.id}] ${r.title}\n${r.text}`).join('\n\n').slice(0, 14000)}` : '',
    ].filter(Boolean).join('\n\n');

    const prompt = `Extract up to ${maxFacts} atomic, specific facts that would make a strong carousel about: "${topic.slice(0, 300)}".

${material}

Rules:
- Only facts EXPLICITLY stated in the material above. Never add outside knowledge. Never round or alter numbers.
- Only facts that directly help answer the request. Skip tangents, however striking (a request on how something works doesn't need rankings or rumours). Fewer, relevant facts beat a full list.
- Prefer concrete numbers, dates, named examples, direct quotes (with speaker) and cause→effect claims.
- One fact per item, max 200 characters, written as a standalone sentence.
- "ref": "SOURCE" if it came from the SOURCE block, otherwise the search result id like "R3".

Return JSON: { "facts": [ { "text": string, "ref": string } ] }`;

    try {
        const r = await ask<{ facts: { text: string; ref: string }[] }>({ role: 'fast', label: 'research.facts' }, prompt, FACTS_SCHEMA);
        const facts: Fact[] = [];
        const sources = new Map<string, SourceRef>();
        for (const f of r.facts || []) {
            const text = String(f.text || '').trim().slice(0, 240);
            if (!text) continue;
            const ref = refs.find((x) => x.id === String(f.ref || '').trim().toUpperCase());
            const fact: Fact = {
                id: `F${facts.length + 1}`,
                text,
                origin: ref ? 'research' : 'source',
                sourceTitle: ref?.title,
                sourceUrl: ref?.url || undefined,
            };
            facts.push(fact);
            if (ref?.url && !sources.has(ref.url)) sources.set(ref.url, { title: ref.title, url: ref.url });
            if (facts.length >= maxFacts) break;
        }
        return { facts, sources: Array.from(sources.values()).slice(0, 8) };
    } catch (err) {
        if (isCancel(err)) throw err;
        console.warn('[v2.research] fact sheet failed:', err);
        return { facts: [], sources: [] };
    }
};

/** Raw search text, kept for grounding (numbers in hits count as supported). */
export const searchText = (results: SearchResult[]): string =>
    results.map((r) => [r.answer || '', ...r.hits.map((h) => h.content)].join('\n')).join('\n');
