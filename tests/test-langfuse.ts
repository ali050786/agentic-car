import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function runTest() {
    console.log('🔍 Testing Langfuse Connection...');
    console.log('PublicKey:', process.env.LANGFUSE_PUBLIC_KEY ? 'Present' : 'Missing');
    console.log('SecretKey:', process.env.LANGFUSE_SECRET_KEY ? 'Present' : 'Missing');
    console.log('Host:', process.env.LANGFUSE_HOST || process.env.LANGFUSE_BASE_URL);

    const { langfuse } = await import('../core/llm/langfuse');
    const { generateContent } = await import('../core/llm/generateContent');

    if (!langfuse) {
        console.error('❌ Langfuse is not initialized (missing environment keys).');
        process.exit(1);
    }

    console.log('1️⃣ Creating trace...');
    const trace = langfuse.trace({
        name: 'test-trace-langfuse-integration',
        userId: 'test-user-123',
        metadata: {
            testEnv: 'local',
        }
    });

    console.log('2️⃣ Making LLM generation through generateContent...');
    try {
        const result = await generateContent({
            prompt: 'Respond with exactly: {"message": "Langfuse works!"}',
            selectedModel: 'claude-haiku',
            systemKeys: {
                anthropic: process.env.CLAUDE_API_KEY
            },
            langfuseTrace: trace
        });

        console.log('✅ Generation successful! Result:', result);

        console.log('3️⃣ Flushing Langfuse events...');
        await langfuse.flushAsync();
        console.log('✅ Events flushed successfully! Please check your Langfuse dashboard.');
    } catch (err: any) {
        console.error('❌ Generation or flush failed:', err);
    }
}

runTest();
