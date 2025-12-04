/// <reference types="vite/client" />

/**
 * Generic generator function that Agents can call with their specific prompts.
 */
export const generateContentFromAgent = async (prompt: string, responseSchema: any) => {
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, responseSchema })
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