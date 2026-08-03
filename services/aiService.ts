/// <reference types="vite/client" />

/**
 * Generic generator function that Agents can call with their specific prompts.
 *
 * Sends the authenticated user's session so the server can verify the request.
 * The platform is free — there are no usage limits.
 */
export const generateContentFromAgent = async (prompt: string | { systemPrompt?: string; prompt: string }, responseSchema: any) => {
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
        const { user } = useAuthStore.getState();

        // Build headers
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // Add user ID and Authorization JWT so the server can verify the session
        if (user?.$id) {
            headers['x-user-id'] = user.$id;

            try {
                const { getClientJwt } = await import('../lib/appwriteClient');
                const jwt = await getClientJwt();
                headers['Authorization'] = `Bearer ${jwt}`;
            } catch (err: any) {
                console.error('[aiService] Failed to get client auth token:', err);
            }
        }

        const res = await fetch('/api/generate', {
            method: 'POST',
            headers,
            body: JSON.stringify({ prompt, responseSchema, selectedModel })
        });

        if (!res.ok) {
            const msg = await res.text();
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
        const headers: Record<string, string> = { 
            'Content-Type': 'application/json' 
        };

        try {
            const { getClientJwt } = await import('../lib/appwriteClient');
            const jwt = await getClientJwt();
            headers['Authorization'] = `Bearer ${jwt}`;
        } catch (err: any) {
            console.error('[aiService] Failed to get client auth token for image gen:', err);
        }

        const res = await fetch('/api/generate-image', {
            method: 'POST',
            headers,
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
