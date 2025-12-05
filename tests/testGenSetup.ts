/**
 * Test Generation Setup
 * 
 * Verifies Claude API key is present and /api/generate endpoint works.
 * Run with: npx ts-node tests/testGenSetup.ts
 * 
 * Location: src/tests/testGenSetup.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log('\n🔍 Testing Claude API Setup...\n');

// Test 1: Check API Key Presence
console.log('1️⃣  Checking API Key Presence:');
const apiKey = process.env.CLAUDE_API_KEY;

if (!apiKey) {
    console.error('❌ CLAUDE_API_KEY is missing!');
    console.error('\n📝 To fix:');
    console.error('   1. Create a .env file in the project root');
    console.error('   2. Add: CLAUDE_API_KEY=your_key_here');
    console.error('   3. Get your free key: https://console.anthropic.com/\n');
    process.exit(1);
} else {
    console.log(`✅ CLAUDE_API_KEY found: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
}

// Test 2: Verify Endpoint (Node.js fetch available in v18+)
console.log('\n2️⃣  Testing /api/generate Endpoint:');
console.log('⚠️  Note: This test requires the dev server to be running (npm run dev)');

const testGeneration = async () => {
    try {
        const response = await fetch('http://localhost:3000/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: 'Generate 2 slides about TypeScript benefits. Return JSON with this structure: {"slides": [{"variant": "hero", "headline": "text", "body": "text"}]}',
                responseSchema: null,
                selectedModel: 'claude-haiku'
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ HTTP Error ${response.status}: ${errorText}`);
            process.exit(1);
        }

        const data = await response.json();

        if (data.error) {
            console.error(`❌ API Error: ${data.error}`);
            if (data.message) console.error(`   Message: ${data.message}`);
            process.exit(1);
        }

        console.log('✅ Endpoint responded successfully!');
        console.log('\n📄 Sample Response:');
        console.log(JSON.stringify(data, null, 2).substring(0, 500) + '...');

        if (data.slides && Array.isArray(data.slides)) {
            console.log(`\n✅ Valid JSON structure with ${data.slides.length} slides`);
        } else {
            console.warn('⚠️  Response does not match expected structure');
        }

    } catch (error: any) {
        if (error.code === 'ECONNREFUSED') {
            console.error('❌ Connection refused. Make sure the dev server is running:');
            console.error('   Run: npm run dev');
        } else {
            console.error(`❌ Error: ${error.message}`);
        }
        process.exit(1);
    }
};

// Run endpoint test only if server is likely running
if (process.argv.includes('--test-endpoint')) {
    testGeneration().then(() => {
        console.log('\n✅ All tests passed!\n');
        process.exit(0);
    });
} else {
    console.log('\n💡 To test the endpoint, run:');
    console.log('   npm run dev  (in another terminal)');
    console.log('   npx ts-node tests/testGenSetup.ts --test-endpoint\n');
    console.log('✅ API key check passed!\n');
}
