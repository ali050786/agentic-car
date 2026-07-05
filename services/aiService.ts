/// <reference types="vite/client" />

import { FREE_TIER_LIMIT } from '../config/constants';

/**
 * Custom error for when free tier limit is reached
 */
export class FreeLimitError extends Error {
    public usageCount: number;

    constructor(message: string, usageCount: number = FREE_TIER_LIMIT) {
        super(message);
        this.name = 'FreeLimitError';
        this.usageCount = usageCount;
    }
}

/**
 * Generic generator function that Agents can call with their specific prompts.
 * 
 * Implements hybrid authentication:
 * - If user has API key stored: sends x-api-key header (BYOK)
 * - If no API key: uses free tier (3 generations max)
 * - Throws FreeLimitError when free tier exhausted
 */
export const generateContentFromAgent = async (prompt: string, responseSchema: any) => {
    // core/agents/*.ts run unmodified in the background worker (Node), where
    // there is no browser and no Zustand store to read model/BYOK state from.
    // Delegate to the Node-side gateway, which gets that context via
    // AsyncLocalStorage instead. Guarded behind a dynamic import so the
    // browser-only store modules below are never loaded under Node.
    if (typeof window === 'undefined') {
        const { generateContentFromAgentServer } = await import('../core/llm/agentGateway');
        return generateContentFromAgentServer(prompt, responseSchema);
    }

    try {
        const { useCarouselStore } = await import('../store/useCarouselStore');
        const { useAuthStore } = await import('../store/useAuthStore');

        const { selectedModel } = useCarouselStore.getState();
        const { user, freeUsageCount } = useAuthStore.getState();

        // Check free tier limit BEFORE making request
        if (user?.$id) {
            console.log(`[aiService] Free tier check: ${freeUsageCount}/${FREE_TIER_LIMIT} used`);

            if (freeUsageCount >= FREE_TIER_LIMIT) {
                console.warn('[aiService] Free tier limit reached before request');
                throw new FreeLimitError(
                    'Free trial exhausted. Please contact support.',
                    freeUsageCount
                );
            }

            // Optimistically increment BEFORE making request to prevent race conditions
            const { incrementUsageCount } = await import('../services/profileService');
            try {
                const newCount = await incrementUsageCount(user.$id);
                console.log(`[aiService] Pre-incremented usage count to ${newCount}`);

                // Update store immediately
                useAuthStore.setState({ freeUsageCount: newCount });
            } catch (error) {
                console.error('[aiService] Failed to increment usage count:', error);
                throw new Error('Failed to update usage tracking. Please try again.');
            }
        }

        // Build headers
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // Add user ID for tracking
        if (user?.$id) {
            headers['x-user-id'] = user.$id;
            // Send updated count (after increment) to backend
            headers['x-usage-count'] = String(freeUsageCount + 1);
        }

        console.log('[aiService] Using free tier');

        const res = await fetch('/api/generate', {
            method: 'POST',
            headers,
            body: JSON.stringify({ prompt, responseSchema, selectedModel })
        });

        // Handle 403 - Free tier limit reached
        if (res.status === 403) {
            const errorData = await res.json();

            if (errorData.error === 'FREE_LIMIT_REACHED') {
                console.warn('[aiService] Free tier limit reached:', errorData);
                throw new FreeLimitError(
                    errorData.message || 'Free trial exhausted. Please add your API key to continue.',
                    errorData.usageCount || FREE_TIER_LIMIT
                );
            }

            throw new Error(errorData.message || 'Access forbidden');
        }

        if (!res.ok) {
            const msg = await res.text();

            // If request failed and we incremented count, we should ideally decrement
            // But since we're using optimistic increment, we'll just refresh the count
            if (!userApiKey && user?.$id) {
                useAuthStore.getState().fetchFreeUsageCount();
            }

            throw new Error(msg || 'Generation failed');
        }

        const result = await res.json();
        return result;
    } catch (error) {
        console.error('[aiService] Generation Error:', error);
        throw error;
    }
};

/**
 * Image generation proxy
 */
export const generateImage = async (prompt: string, aspectRatio: string = '1:1'): Promise<{ imageUrl: string; imageBase64?: string | null }> => {
    try {
        const res = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, aspectRatio })
        });

        if (!res.ok) {
            const msg = await res.text();
            throw new Error(msg || 'Image generation failed');
        }

        const data = await res.json();
        console.log('[aiService] 🎨 Image generated successfully:', data.imageUrl);
        return data;
    } catch (error) {
        console.error('[aiService] Image Generation Error:', error);
        throw error;
    }
};
