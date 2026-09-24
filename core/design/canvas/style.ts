/**
 * Picking a Canvas look without a model: from the user's own words ("make it
 * minimal") or from what the deck is about. Client-safe (no agent imports),
 * so the studio can design a deck instantly when it's switched to the Canvas.
 */

import type { CreativeBrief } from '../../../types';
import type { DesignStyle, Direction } from './types';
import { defaultStyle } from './tokens';

const WORD_DIRECTIONS: [RegExp, Direction][] = [
    [/\bbrutalis[mt]\b|\braw\b|\bneo-?brutal/i, 'brutalist'],
    [/\bminimal(ist|istic)?\b|\bclean and simple\b|\bwhite ?space\b/i, 'minimal'],
    [/\beditorial\b|\belegant\b|\bserif\b|\bsophisticated\b|\bluxury\b/i, 'editorial'],
    [/\bmagazine\b|\bvogue\b|\bnewspaper\b/i, 'magazine'],
    [/\bplayful\b|\bfun\b|\bcute\b|\bkids?\b|\bchildren\b|\bcolou?rful\b/i, 'playful'],
    [/\btech(y|nical)?\b|\bdeveloper\b|\bterminal\b|\bcode\b|\bengineer/i, 'tech'],
    [/\bcorporate\b|\bprofessional\b|\bbusiness\b|\bb2b\b|\bconsult/i, 'corporate'],
    [/\bbold\b|\bpunchy\b|\bloud\b|\bstriking\b|\bpunk\b/i, 'bold'],
];

/** The look the user asked for in their own words, if any. */
export const directionFromWords = (text: string): Direction | null => {
    for (const [re, d] of WORD_DIRECTIONS) if (re.test(text || '')) return d;
    return null;
};

/** No model: a sensible direction from what the deck is about. */
export const heuristicStyle = (topic: string, brief?: CreativeBrief, userText = ''): DesignStyle => {
    const asked = directionFromWords(userText);
    if (asked) return defaultStyle(asked);
    const t = `${topic} ${brief?.audience?.description || ''} ${brief?.creativeStyle?.toneDescription || ''}`.toLowerCase();
    const audience = brief?.audience?.type || '';
    let d: Direction = 'bold';
    if (/kid|child|school|classroom|parent/.test(t) || audience === 'KIDS') d = 'playful';
    else if (/\b(ai|api|code|coding|developer|software|engineer|data|devops|cloud|security|startup tech)\b/.test(t)) d = 'tech';
    else if (/financ|invest|bank|b2b|sales|strategy|leadership|compliance|consult|revenue|market share/.test(t)) d = 'corporate';
    else if (/fashion|travel|food|culture|design|art|lifestyle|history|book|film|music/.test(t)) d = 'editorial';
    else if (/news|trend|report|study|research|survey/.test(t)) d = 'magazine';
    return defaultStyle(d);
};

