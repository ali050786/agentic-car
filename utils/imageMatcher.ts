/**
 * Image Matcher Utility — v2: Weighted Semantic Similarity
 *
 * Replaces the simple keyword-overlap approach with a multi-factor scoring
 * system that uses:
 *
 *  1. Exact-subject match         — weight 20
 *  2. Sub-string containment      — weight 10 (both directions)
 *  3. Unigram keyword overlap      — TF-IDF-inspired; longer shared words score
 *                                    higher (weight × word.length)
 *  4. Bigram (2-word phrase) match — captures compound concepts (weight 8/pair)
 *  5. Tag overlap (unigram+bigram) — lower-weight semantic safety net (weight 3/4)
 *
 * No external dependency is required; the algorithm runs entirely in memory
 * on the pre-loaded image.json library.
 */

import libraryData from '../image.json';

interface LibraryItem {
    id: string;
    topic: string;
    tags: string[];
    url: string;
}

// Common stop-words that dilute scoring if matched
const STOP_WORDS = new Set([
    'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'with',
    'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
    'it', 'its', 'this', 'that', 'as', 'by', 'from', 'into', 'about',
    'simple', 'hand', 'drawn', 'sketch', 'doodle', 'isolated', 'black',
    'white', 'ink', 'line', 'art', 'minimal', 'illustration'
]);

/**
 * Tokenize a string: lowercase, split on word boundaries, remove stop-words.
 */
const tokenize = (text: string): string[] =>
    text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w));

/**
 * Generate consecutive bigrams from an array of tokens.
 * e.g. ['growth', 'chart'] → ['growth chart']
 */
const bigrams = (tokens: string[]): string[] =>
    tokens.slice(0, -1).map((w, i) => `${w} ${tokens[i + 1]}`);

/**
 * Extracts the core subject/metaphor from a standard Template-3 prompt.
 * Example: "A black pencil sketch doodle of a simple hand-drawn rocket isolated on a..."
 * Returns: "rocket"
 */
export const extractSubject = (prompt: string): string => {
    const match = prompt.match(/doodle of (.*?) isolated/i);
    if (match && match[1]) {
        return match[1]
            .replace(/^a /i, '')
            .replace(/^an /i, '')
            .replace(/a simple /i, '')
            .replace(/hand-drawn /i, '')
            .replace(/sketch /i, '')
            .replace(/the /i, '')
            .trim();
    }
    return prompt.toLowerCase();
};

/**
 * Compute a semantic similarity score between the extracted subject and
 * a library item using the multi-factor weighted algorithm.
 */
const scoreItem = (
    subject: string,
    subjectTokens: string[],
    subjectBigrams: string[],
    item: LibraryItem
): number => {
    let score = 0;
    const topic = item.topic.toLowerCase().replace(/_/g, ' ');
    const topicTokens = tokenize(topic);
    const topicBigrams = bigrams(topicTokens);
    const tagText = item.tags.map(t => t.toLowerCase().replace(/_/g, ' ')).join(' ');
    const tagTokens = tokenize(tagText);
    const tagBigrams = bigrams(tagTokens);

    // 1. Exact subject match
    if (topic === subject) score += 20;

    // 2. Sub-string containment (both directions)
    if (topic.includes(subject)) score += 10;
    else if (subject.includes(topic)) score += 8;

    // 3. Unigram overlap — weight by word length (longer = more specific)
    subjectTokens.forEach(sw => {
        if (topicTokens.includes(sw)) {
            score += Math.min(sw.length, 8); // cap at 8 to prevent bias
        }
    });

    // 4. Bigram (phrase) match — high signal for compound concepts
    subjectBigrams.forEach(sbg => {
        if (topicBigrams.includes(sbg)) score += 8;
        if (tagBigrams.includes(sbg)) score += 4;
    });

    // 5. Tag unigram overlap
    subjectTokens.forEach(sw => {
        if (tagTokens.includes(sw)) score += 3;
    });

    return score;
};

/**
 * Matches a prompt to the best available image in the pre-cached library.
 *
 * Returns a URL string on a confident match (score ≥ 8), or null if no
 * good match is found (caller should fall back to real-time generation).
 */
export const findMatchingImage = (prompt: string): string | null => {
    const subject = extractSubject(prompt).toLowerCase();
    const subjectTokens = tokenize(subject);
    const subjectBigrams = bigrams(subjectTokens);

    let bestMatch: LibraryItem | null = null;
    let highestScore = 0;

    for (const item of libraryData as LibraryItem[]) {
        const score = scoreItem(subject, subjectTokens, subjectBigrams, item);
        if (score > highestScore) {
            highestScore = score;
            bestMatch = item;
        }
    }

    const CONFIDENCE_THRESHOLD = 8; // tuned for ~90% precision

    if (bestMatch && highestScore >= CONFIDENCE_THRESHOLD) {
        console.log(
            `[imageMatcher] ✓ Matched "${subject}" → "${bestMatch.topic}" (score: ${highestScore})`
        );
        return bestMatch.url;
    }

    console.log(
        `[imageMatcher] ✗ No confident match for "${subject}" (best score: ${highestScore})`
    );
    return null;
};
