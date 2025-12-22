/**
 * Image Matcher Utility
 * 
 * Maps AI-generated doodle prompts to pre-cached images in the library.
 * This helps reduce latency and costs by reusing existing assets.
 */

import libraryData from '../image.json';

interface LibraryItem {
    id: string;
    topic: string;
    tags: string[];
    url: string;
}

/**
 * Extracts the core subject/metaphor from a standard Template-3 prompt.
 * Example prompt: "A black pencil sketch doodle of a simple hand-drawn rocket isolated on a..."
 * Extracted: "rocket"
 */
export const extractSubject = (prompt: string): string => {
    const match = prompt.match(/doodle of (.*?) isolated/i);
    if (match && match[1]) {
        // Clean up common fluff words
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
 * Matches a prompt to the best available image in the library.
 */
export const findMatchingImage = (prompt: string): string | null => {
    const subject = extractSubject(prompt).toLowerCase();
    const keywords = subject.split(/\s+/).filter(k => k.length > 2);

    let bestMatch: LibraryItem | null = null;
    let highestScore = 0;

    for (const item of libraryData as LibraryItem[]) {
        let score = 0;
        const topic = item.topic.toLowerCase().replace(/_/g, ' ');

        // 1. Direct topic match (highest weight)
        if (topic.includes(subject) || subject.includes(topic)) {
            score += 10;
        }

        // 2. Keyword overlap with topic
        keywords.forEach(kw => {
            if (topic.includes(kw)) score += 5;
        });

        // 3. Tag overlap
        item.tags.forEach(tag => {
            const normalizedTag = tag.toLowerCase().replace(/_/g, ' ');
            if (subject.includes(normalizedTag)) score += 3;
            keywords.forEach(kw => {
                if (normalizedTag.includes(kw)) score += 2;
            });
        });

        if (score > highestScore) {
            highestScore = score;
            bestMatch = item;
        }
    }

    // Only return if we have a reasonably confident match
    if (bestMatch && highestScore >= 5) {
        console.log(`[imageMatcher] Matched "${subject}" to library item "${bestMatch.topic}" (Score: ${highestScore})`);
        return bestMatch.url;
    }

    console.log(`[imageMatcher] No confident match for "${subject}" (Best score: ${highestScore})`);
    return null;
};
