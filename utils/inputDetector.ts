/**
 * Auto-detects what kind of source the user just typed/pasted into the
 * composer, so the first-message flow can route to the right fetch (or none)
 * without dedicated topic/text/url/video tabs.
 */

import { isYouTubeUrl, getVideoID } from './contentProcessor';

// Matches MainAgent's own CONTEXT-vs-TOPIC threshold, so "text" mode here
// lines up with what runAgentWorkflow would already treat as pasted context.
const CONTEXT_LENGTH_THRESHOLD = 500;

const URL_REGEX = /https?:\/\/[^\s]+/i;

export interface DetectedInput {
    mode: 'topic' | 'text' | 'url' | 'video';
    url?: string;
    videoId?: string;
    /** The message with any detected URL removed, trimmed — the user's actual instruction/angle. */
    instruction: string;
}

export const detectInputMode = (message: string): DetectedInput => {
    const trimmed = message.trim();
    const urlMatch = trimmed.match(URL_REGEX);

    if (urlMatch) {
        const url = urlMatch[0].replace(/[.,;:!?)\]'"]+$/, '');
        const instruction = trimmed.replace(urlMatch[0], '').trim();

        if (isYouTubeUrl(url)) {
            const videoId = getVideoID(url);
            if (videoId) {
                return { mode: 'video', url, videoId, instruction };
            }
        }

        return { mode: 'url', url, instruction };
    }

    if (trimmed.length > CONTEXT_LENGTH_THRESHOLD) {
        return { mode: 'text', instruction: trimmed };
    }

    return { mode: 'topic', instruction: trimmed };
};
