/**
 * Doodle Generator - shared image tool.
 *
 * Generates a Template-3 sketch via Replicate flux (with throttle retries)
 * and persists it to Appwrite Storage. Used by the background pipeline in
 * MainAgent and by the chat orchestrator's image intent.
 */

import { generateImage } from '../services/aiService';
import { storage, config, ID } from '../lib/appwriteClient';
import { buildFluxPrompt } from '../core/agents/ArtDirectorAgent';

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export const generateDoodleWithRetry = async (
    scene: string,
    maxAttempts: number = 5
): Promise<{ url: string; prompt: string }> => {
    const prompt = buildFluxPrompt(scene);

    for (let attempt = 1; ; attempt++) {
        try {
            const { imageUrl, imageBase64 } = await generateImage(prompt, '2:3');

            let finalUrl = imageUrl;
            if (config.storageBucketId && imageBase64) {
                try {
                    // Decode manually — fetch(data:...) is blocked by the app's CSP connect-src
                    const binary = atob(imageBase64.split(',')[1]);
                    const bytes = new Uint8Array(binary.length);
                    for (let b = 0; b < binary.length; b++) bytes[b] = binary.charCodeAt(b);
                    const file = new File([new Blob([bytes], { type: 'image/webp' })], `doodle-${ID.unique()}.webp`, { type: 'image/webp' });
                    const uploaded = await storage.createFile(config.storageBucketId, ID.unique(), file);
                    finalUrl = storage.getFileView(config.storageBucketId, uploaded.$id).toString();
                } catch (persistErr) {
                    console.error('[doodleGenerator] Upload failed, using ephemeral URL:', persistErr);
                }
            }
            return { url: finalUrl, prompt };
        } catch (err: any) {
            const msg = String(err?.message || err);
            const throttled = msg.includes('429') || msg.includes('throttled');
            if (!throttled || attempt >= maxAttempts) throw err;
            const retryMatch = msg.match(/retry_after\\?":\s*(\d+)/);
            const waitSeconds = (retryMatch ? parseInt(retryMatch[1], 10) : 10) + 2;
            console.warn(`[doodleGenerator] Replicate throttled (attempt ${attempt}/${maxAttempts}), retrying in ${waitSeconds}s...`);
            await wait(waitSeconds * 1000);
        }
    }
};
