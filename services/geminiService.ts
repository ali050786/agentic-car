/// <reference types="vite/client" />

import { useCarouselStore } from '../store/useCarouselStore';

/**
 * Generic generator function that Agents can call with their specific prompts.
 */
export const generateContentFromAgent = async (prompt: string, responseSchema: any) => {
  try {
    // Get selected model from store
    const { selectedModel } = useCarouselStore.getState();

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, responseSchema, selectedModel })
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || 'Generation failed');
    }
    return await res.json();
  } catch (error) {
    console.error('Generation Error:', error);
    throw error;
  }
};