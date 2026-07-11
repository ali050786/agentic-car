/**
 * Extracts YouTube video ID from various URL formats
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://youtube.com/embed/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * - URLs with additional parameters
 * 
 * @param url - YouTube URL
 * @returns Video ID or null if not found
 */
export function getVideoID(url: string): string | null {
    try {
        // Handle empty or invalid input
        if (!url || typeof url !== 'string') {
            return null;
        }

        // Remove whitespace
        url = url.trim();

        // Pattern 1: youtube.com/watch?v=VIDEO_ID
        const watchPattern = /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/;
        const watchMatch = url.match(watchPattern);
        if (watchMatch) {
            return watchMatch[1];
        }

        // Pattern 2: youtu.be/VIDEO_ID
        const shortPattern = /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const shortMatch = url.match(shortPattern);
        if (shortMatch) {
            return shortMatch[1];
        }

        // Pattern 3: youtube.com/embed/VIDEO_ID
        const embedPattern = /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
        const embedMatch = url.match(embedPattern);
        if (embedMatch) {
            return embedMatch[1];
        }

        // Pattern 4: youtube.com/v/VIDEO_ID
        const vPattern = /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/;
        const vMatch = url.match(vPattern);
        if (vMatch) {
            return vMatch[1];
        }

        // No match found
        return null;
    } catch (error) {
        console.error('Error extracting video ID:', error);
        return null;
    }
}

/**
 * Validates if a URL is a valid YouTube URL
 * @param url - URL to validate
 * @returns true if the URL is a valid YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
        return false;
    }

    const youtubePatterns = [
        /^https?:\/\/(www\.)?youtube\.com/,
        /^https?:\/\/youtu\.be/,
        /^https?:\/\/m\.youtube\.com/,
    ];

    return youtubePatterns.some(pattern => pattern.test(url.trim()));
}

export interface ScrapedContent {
    content: string;
    title?: string;
    truncated: boolean;
    originalLength: number;
}

/**
 * Fetches and extracts readable article text from a URL via the server-side
 * /api/scrape endpoint (avoids CORS — the browser can't fetch arbitrary
 * third-party pages directly). Truncation happens server-side (no point
 * shipping the full HTML just to cut it client-side) — originalLength/truncated
 * let the caller show the user what was cut.
/**
 * Helper to fetch authorization headers with Appwrite JWT.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    try {
        const { getClientJwt } = await import('../lib/appwriteClient');
        const jwt = await getClientJwt();
        headers['Authorization'] = `Bearer ${jwt}`;
    } catch (err) {
        console.error('[contentProcessor] Failed to get client auth token:', err);
    }
    return headers;
}

/**
 * Fetches and extracts readable article text from a URL via the server-side
 * /api/scrape endpoint (avoids CORS — the browser can't fetch arbitrary
 * third-party pages directly). Truncation happens server-side (no point
 * shipping the full HTML just to cut it client-side) — originalLength/truncated
 * let the caller show the user what was cut.
 *
 * @param url - URL to fetch content from
 */
export async function fetchUrlContent(url: string): Promise<ScrapedContent> {
    if (!url || typeof url !== 'string') {
        throw new Error('Invalid URL provided');
    }

    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(url.trim())) {
        throw new Error('URL must start with http:// or https://');
    }

    const headers = await getAuthHeaders();
    const response = await fetch(`/api/scrape?url=${encodeURIComponent(url.trim())}`, {
        headers
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data?.error || `Failed to read the page (${response.status})`);
    }

    if (!data.content || data.content.length < 100) {
        throw new Error('Could not extract readable content from this page.');
    }

    return {
        content: data.content,
        title: data.title || '',
        truncated: !!data.truncated,
        originalLength: typeof data.originalLength === 'number' ? data.originalLength : data.content.length,
    };
}

/**
 * Fetches video transcript/content from YouTube via backend API
 * 
 * @param videoId - YouTube video ID
 * @returns Promise resolving to the video transcript
 */
export async function fetchYouTubeContent(videoId: string): Promise<string> {
    try {
        if (!videoId || typeof videoId !== 'string') {
            throw new Error('Invalid video ID provided');
        }

        console.log('[YouTube] Fetching transcript for video ID:', videoId);

        const authHeaders = await getAuthHeaders();
        // Call backend API endpoint
        const response = await fetch('/api/youtube-transcript', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            },
            body: JSON.stringify({ videoId }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch transcript');
        }

        const data = await response.json();

        if (!data.transcript || data.transcript.length < 10) {
            throw new Error('Transcript is too short or empty. The video may not have captions available.');
        }

        console.log(`[YouTube] Successfully fetched transcript (${data.transcript.length} characters)`);

        return data.transcript;

    } catch (error: any) {
        console.error('[YouTube] Error:', error);

        // Provide user-friendly error messages
        if (error.message?.includes('disabled') || error.message?.includes('not have captions')) {
            throw new Error('This video does not have captions/transcripts available. Please try a different video or use the Text tab to paste the video description.');
        }

        throw new Error(`Failed to fetch YouTube content: ${error.message || 'Unknown error'}`);
    }
}

/**
 * Validates and normalizes a URL
 * @param url - URL to validate
 * @returns Normalized URL or throws error
 */
export function validateUrl(url: string): string {
    try {
        const normalized = url.trim();
        const urlObj = new URL(normalized);
        return urlObj.href;
    } catch (error) {
        throw new Error('Invalid URL format');
    }
}

/**
 * Extracts domain name from URL
 * @param url - URL to extract domain from
 * @returns Domain name (e.g., "example.com")
 */
export function extractDomain(url: string): string {
    try {
        const urlObj = new URL(url.trim());
        return urlObj.hostname.replace(/^www\./, '');
    } catch (error) {
        return '';
    }
}
