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

/**
 * Fetches content from a URL via backend scraping API
 * 
 * PLACEHOLDER IMPLEMENTATION:
 * Currently returns mock data. In production, this should call
 * a backend endpoint like /api/scrape to handle CORS issues.
 * 
 * Future implementation:
 * ```typescript
 * const response = await fetch('/api/scrape', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ url })
 * });
 * const data = await response.json();
 * return data.content;
 * ```
 * 
 * @param url - URL to fetch content from
 * @returns Promise resolving to the page content
 */
export async function fetchUrlContent(url: string): Promise<string> {
    try {
        // Validate URL
        if (!url || typeof url !== 'string') {
            throw new Error('Invalid URL provided');
        }

        // Basic URL validation
        const urlPattern = /^https?:\/\/.+/;
        if (!urlPattern.test(url.trim())) {
            throw new Error('URL must start with http:// or https://');
        }

        // PLACEHOLDER: Return mock data
        // TODO: Replace with actual backend API call
        console.log('[PLACEHOLDER] Would fetch content from URL:', url);

        return `Scraped content placeholder for URL: ${url}\n\nThis is mock content. In production, this function will call a backend API endpoint (/api/scrape) to fetch the actual page content and avoid CORS issues.\n\nThe backend should:\n1. Fetch the URL content\n2. Extract main text content\n3. Remove ads, navigation, and boilerplate\n4. Return clean article text`;

    } catch (error: any) {
        throw new Error(`Failed to fetch URL content: ${error.message || 'Unknown error'}`);
    }
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

        // Call backend API endpoint
        const response = await fetch('/api/youtube-transcript', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
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
