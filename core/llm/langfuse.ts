import { Langfuse } from 'langfuse';

const secretKey = process.env.LANGFUSE_SECRET_KEY;
const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
const baseUrl = process.env.LANGFUSE_HOST || process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';

const enabled = !!(secretKey && publicKey);

if (!enabled) {
    console.log('[Langfuse] ℹ️ Credentials not found in environment. Tracing is disabled.');
} else {
    console.log(`[Langfuse] 🚀 Initialized with host: ${baseUrl}`);
}

export const langfuse = enabled
    ? new Langfuse({
        secretKey,
        publicKey,
        baseUrl,
    })
    : null;
