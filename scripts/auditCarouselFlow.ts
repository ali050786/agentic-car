import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Inject mock Appwrite variables if missing to prevent appwriteServer.ts from throwing on import
if (!process.env.APPWRITE_ENDPOINT) process.env.APPWRITE_ENDPOINT = 'http://localhost/v1';
if (!process.env.APPWRITE_PROJECT_ID) process.env.APPWRITE_PROJECT_ID = 'mock-project';
if (!process.env.APPWRITE_API_KEY) process.env.APPWRITE_API_KEY = 'mock-api-key';

// Import databasesServer and mock its database calls to avoid Appwrite errors
const { databasesServer } = await import('../lib/appwriteServer');
databasesServer.getDocument = async () => ({} as any);
databasesServer.updateDocument = async () => ({} as any);
databasesServer.createDocument = async () => ({ $id: 'mock-doc' } as any);

// Dynamic imports to ensure environment variables and mocks are set before modules load
const { ResearchAgent } = await import('../core/agents/ResearchAgent');
const { StrategistAgent } = await import('../core/agents/StrategistAgent');
const { TemplateAgent } = await import('../core/agents/TemplateAgent');
const { ProofreaderAgent } = await import('../core/agents/ProofreaderAgent');
const { ArtDirectorAgent } = await import('../core/agents/ArtDirectorAgent');
const { runWithAgentContext } = await import('../core/llm/agentGateway');
const { getPresetById } = await import('../config/colorPresets');
const { resolveTheme } = await import('../utils/brandUtils');
const { polishSlides } = await import('../utils/contentPolish');
import type { AgentContext } from '../core/agents/agentContext';
import type { CreativeBrief } from '../types';

// Detect CLI arguments
const args = process.argv.slice(2);
const isMockMode = args.includes('--mock') || 
                   (!process.env.OPENROUTER_API_KEY && !process.env.GROQ_API_KEY && !process.env.CLAUDE_API_KEY);

console.log(`====================================================`);
console.log(`🚀 Carousel Generation Audit Tool`);
console.log(`Execution Mode: ${isMockMode ? 'MOCK MODE (Dry Run)' : 'LIVE MODE (Calling APIs)'}`);
console.log(`====================================================\n`);

// Log collector
interface NetworkLog {
    timestamp: string;
    type: 'LLM' | 'TAVILY' | 'REPLICATE' | 'OTHER';
    url: string;
    method: string;
    requestHeaders: any;
    requestBody: any;
    status?: number;
    responseBody?: any;
    durationMs?: number;
}

const networkLogs: NetworkLog[] = [];

// Intercept fetch calls
const originalFetch = globalThis.fetch;
globalThis.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
    const method = init?.method || 'GET';
    const headers = init?.headers ? { ...init.headers } : {};

    // Redact API keys from logged headers
    const loggedHeaders: any = {};
    for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase().includes('auth') || k.toLowerCase().includes('key') || k.toLowerCase().includes('token')) {
            loggedHeaders[k] = '[REDACTED]';
        } else {
            loggedHeaders[k] = v;
        }
    }

    let requestBody: any = null;
    if (init?.body) {
        if (typeof init.body === 'string') {
            try {
                requestBody = JSON.parse(init.body);
            } catch {
                requestBody = init.body;
            }
        } else {
            requestBody = '[Non-string Body]';
        }
    }

    const logEntry: NetworkLog = {
        timestamp: new Date().toISOString(),
        type: url.includes('tavily') ? 'TAVILY' : (url.includes('replicate') ? 'REPLICATE' : 'LLM'),
        url,
        method,
        requestHeaders: loggedHeaders,
        requestBody
    };

    networkLogs.push(logEntry);
    const startTime = Date.now();

    if (isMockMode) {
        // Return simulated mock responses to let the audit execute without API keys or costs
        logEntry.durationMs = Math.floor(Math.random() * 200 + 100);
        logEntry.status = 200;

        let responseJSON: any = {};

        if (url.includes('tavily')) {
            responseJSON = {
                answer: "Research shows that developers lose 23 minutes of focus per distraction.",
                results: [
                    { title: "The Cost of Distraction", content: "A study by Gloria Mark at UC Irvine showed that it takes an average of 23 minutes and 15 seconds to return to the original task after an interruption.", url: "https://ics.uci.edu/~gmark/" },
                    { title: "Developer Focus Tips", content: "Minimizing workspace context switching and context loss significantly boosts coding throughput.", url: "https://example.com/dev-focus" }
                ]
            };
        } else if (url.includes('replicate')) {
            responseJSON = {
                status: "succeeded",
                output: ["https://replicate.delivery/pbxt/mockdoodle/doodle.webp"]
            };
        } else {
            // LLM routing
            const promptText = JSON.stringify(requestBody);
            const isClaude = url.includes('anthropic');
            
            let contentText = '{}';
            if (promptText.includes('ANALYSIS_SYSTEM_PROMPT') || promptText.includes('determine if additional research is needed')) {
                contentText = JSON.stringify({
                    strategy: 'EXPLORATORY',
                    reasoning: 'The topic of developer distraction needs concrete statistics and studies to back up the hooks.',
                    searchQueries: ['Gloria Mark distraction 23 minutes', 'developer focus study statistics']
                });
            } else if (promptText.includes('Content Strategist') || promptText.includes('generateViralAngle')) {
                contentText = JSON.stringify({
                    premise: 'Focus is not a trait; it is a developer environment design pattern. Interruption costs 23 minutes.',
                    audience: 'Junior software developers and students.',
                    takeaway: 'Control your IDE, your phone, and your Slack, or they will control your career.'
                });
            } else if (promptText.includes('SLIDE COUNT') || promptText.includes('You MUST produce EXACTLY')) {
                contentText = JSON.stringify({
                    slides: [
                        { variant: 'hero', preHeader: 'DEVELOPER PRODUCTIVITY', headline: 'HOW TO FOCUS IN A WORLD OF DISTRACTION', body: 'The hidden cognitive tax destroying your engineering velocity.', footer: 'Swipe to calculate the tax →', icon: 'target', doodleTopic: 'focus' },
                        { variant: 'body', preHeader: 'THE COGNITIVE TAX', headline: 'THE 23-MINUTE PENALTY', body: 'Research shows it takes 23 minutes to return to a deep coding flow after just one Slack ping.', footer: 'How does it happen? →', icon: 'clock', doodleTopic: 'brain_cog' },
                        { variant: 'body', preHeader: 'STEP 1: SHIELD THE FLOW', headline: 'DECLUTTER THE ENVIRONMENT', body: 'Close tabs. Put your phone in another room. Go offline on communication channels.', footer: 'Next step →', icon: 'bell-off', doodleTopic: 'shield' },
                        { variant: 'body', preHeader: 'STEP 2: INTERVAL TRACKING', headline: 'DEVELOP IN DEEP CYCLES', body: 'Code in uninterrupted 90-minute blocks. Short breaks feed creative output.', footer: 'Next step →', icon: 'activity', doodleTopic: 'climbing' },
                        { variant: 'closing', preHeader: 'TAKE ACTION NOW', headline: 'BLOCK OUT YOUR CALENDAR', body: 'Go quiet for the next 90 minutes. Write your best code today.', footer: 'Share if you saved your focus!', icon: 'check-circle', doodleTopic: 'victory' }
                    ],
                    theme: {
                        bg: '#0F172A',
                        text: '#F8FAFC',
                        accent: '#38BDF8',
                        cardBg: '#1E293B',
                        cardText: '#E2E8F0',
                        accentPhraseColor: '#38BDF8'
                    }
                });
            } else if (promptText.includes('proofreader for carousel copy')) {
                const promptVal = requestBody.prompt || (requestBody.messages ? requestBody.messages.map((m: any) => m.content).join('\n') : '');
                const matchCount = promptVal.match(/JSON array of (\d+) slides/);
                const slideCount = matchCount ? parseInt(matchCount[1], 10) : 1;
                contentText = JSON.stringify({
                    slides: Array.from({ length: slideCount }, () => ({
                        preHeader: '',
                        headline: '',
                        body: '',
                        footer: ''
                    }))
                });
            } else if (promptText.includes('Art Director for an editorial')) {
                const promptVal = requestBody.prompt || (requestBody.messages ? requestBody.messages.map((m: any) => m.content).join('\n') : '');
                const matches = [...promptVal.matchAll(/Slide (\d+) \[/g)];
                const slideCount = matches.length || 5;
                const prompts = Array.from({ length: slideCount }, (_, idx) => ({
                    slideIndex: idx,
                    subject: `a dynamic illustration for slide ${idx + 1}`
                }));
                contentText = JSON.stringify({ prompts });
            }

            if (isClaude) {
                responseJSON = {
                    content: [{ text: contentText }],
                    usage: { input_tokens: 1500, output_tokens: 300 }
                };
            } else {
                responseJSON = {
                    choices: [{ message: { content: contentText }, finish_reason: 'stop' }],
                    usage: { prompt_tokens: 1200, completion_tokens: 250, total_tokens: 1450 }
                };
            }
        }

        logEntry.responseBody = responseJSON;
        
        // Mock a Response object
        return {
            ok: true,
            status: 200,
            json: async () => responseJSON,
            text: async () => typeof responseJSON === 'string' ? responseJSON : JSON.stringify(responseJSON),
            clone: function() { return this; }
        } as any;
    }

    // Live call
    try {
        const response = await originalFetch(input, init);
        logEntry.durationMs = Date.now() - startTime;
        logEntry.status = response.status;
        
        const cloned = response.clone();
        try {
            const txt = await cloned.text();
            try {
                logEntry.responseBody = JSON.parse(txt);
            } catch {
                logEntry.responseBody = txt;
            }
        } catch (e) {
            logEntry.responseBody = `[Failed to parse body: ${e}]`;
        }
        return response;
    } catch (err: any) {
        logEntry.durationMs = Date.now() - startTime;
        logEntry.status = 0;
        logEntry.responseBody = `[Network Error: ${err?.message || err}]`;
        throw err;
    }
};

// Execution test configuration
const topic = "How to focus in a world of distraction";
const creativeBrief: any = {
    contentType: 'EDUCATIONAL',
    audience: {
        description: 'Junior developers and computer science students.',
        customVibe: 'Practical, technical, empathetic'
    },
    contentStrategy: {
        approachMode: 'HOW_TO_STEPS',
        mustStayOnTopic: true,
        businessMetaphorsAllowed: false,
        stayFactuallyAccurate: true
    },
    creativeStyle: {
        toneDescription: 'Practical, scientific, encouraging, direct and engineering-oriented',
        customTemplateParams: {}
    },
    visualStyle: {
        illustrationMode: 'METAPHORICAL'
    },
    suggestedSlideCount: 5,
    outputLanguage: 'English'
};

const tokenTracker = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cachedTokens: 0
};

// Run the pipeline
const runAudit = async () => {
    console.log(`Starting generation flow for topic: "${topic}"...\n`);

    await runWithAgentContext(
        { userId: 'audit-user-123', selectedModel: 'openrouter/free', tokenTracker },
        async () => {
            // 1. Research Needs Analysis
            console.log(`[Phase 1] Research Needs Analysis...`);
            const researchAnalysis = await ResearchAgent.analyzeInputNeeds(topic);
            console.log(`Strategy Chosen: ${researchAnalysis.strategy}`);
            console.log(`Queries: ${JSON.stringify(researchAnalysis.searchQueries)}\n`);

            // 2. Perform Research
            let finalContent = topic;
            if (researchAnalysis.strategy !== 'NONE') {
                console.log(`[Phase 2] Executing Tavily Search...`);
                const researchData = await ResearchAgent.performResearch(researchAnalysis.searchQueries);
                finalContent += researchData;
                console.log(`Research context added. Length: ${researchData.length} characters\n`);
            }

            // 3. Strategist Agent: Viral Angle
            console.log(`[Phase 3] Generating Viral Angle & Hook...`);
            const viralAngle = await StrategistAgent.generateViralAngle(
                finalContent,
                'TOPIC',
                '',
                creativeBrief
            );
            console.log(`Viral Angle:\n${viralAngle}\n`);

            // 4. Template Agent: Slide Generation
            console.log(`[Phase 4] Designing Slides and Copy...`);
            const context: AgentContext = {
                inputMode: 'topic',
                sourceContent: topic,
                customInstructions: '',
                outputLanguage: 'English',
                slideCount: 5,
                viralAngle,
                userMemory: [],
                creativeBrief,
            };

            const result = await TemplateAgent.generate(context, 'template-3');
            result.slides = polishSlides(result.slides);
            console.log(`Draft Slides Count: ${result.slides.length}\n`);

            // 5. Proofreader Agent
            console.log(`[Phase 5] Proofreading Copy...`);
            result.slides = await ProofreaderAgent.proofread(result.slides, creativeBrief);
            result.slides = polishSlides(result.slides);
            console.log(`Proofreading complete.\n`);

            // 6. Art Director Agent
            console.log(`[Phase 6] Generating Doodle Prompts...`);
            const fluxPrompts = await ArtDirectorAgent.generatePrompts(result.slides, viralAngle);
            console.log(`Generated Doodle Prompts count: ${fluxPrompts.length}`);
            fluxPrompts.forEach((p, idx) => console.log(`  Slide ${idx}: "${p.slice(0, 100)}..."`));
            console.log();

            // 7. Mock Replicate Doodles
            console.log(`[Phase 7] Replicate Doodle Generation (Simulated)...`);
            for (let i = 0; i < result.slides.length; i++) {
                if (fluxPrompts[i]) {
                    // Make a fake fetch to trigger replicate interception logs
                    const prompt = fluxPrompts[i];
                    await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Token mock-token',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            input: {
                                prompt,
                                go_fast: true,
                                aspect_ratio: '2:3'
                            }
                        })
                    });
                }
            }
            console.log(`Simulated Replicate triggers logged.\n`);

            console.log(`🎉 Pipeline completed successfully!`);
            console.log(`Token Usage Summary:`, tokenTracker);
            console.log(`Total captured network logs: ${networkLogs.length}`);

            // Write report
            await writeReport();
        }
    );
};

const writeReport = async () => {
    const reportPath = path.resolve('/Users/sikandar/.gemini/antigravity-ide/brain/83022b39-7427-4273-beec-a331a84621f9/carousel_audit_report.md');
    console.log(`\nWriting report to: ${reportPath}...`);

    let md = `# Carousel Generation Pipeline Audit Report\n\n`;
    md += `This report details the end-to-end execution of the Carousel Generation Pipeline for the topic: **"${topic}"**.\n`;
    md += `**Execution Mode**: ${isMockMode ? 'MOCK / SIMULATED' : 'LIVE API RUN'}\n`;
    md += `**Timestamp**: ${new Date().toISOString()}\n\n`;

    md += `## 1. Flow Diagram of Multi-Agent Orchestration\n\n`;
    md += `\`\`\`mermaid\n`;
    md += `graph TD\n`;
    md += `    Start[User Topic: "${topic}"] --> RA[Research Agent]\n`;
    md += `    RA -- Formulates Search Queries --> Tavily[Tavily Search API]\n`;
    md += `    Tavily -- Returns Context --> SA[Strategist Agent]\n`;
    md += `    SA -- Synthesizes Angle / Premise --> TA[Template Agent]\n`;
    md += `    TA -- Generates Raw JSON Slides --> PA[Proofreader Agent]\n`;
    md += `    PA -- Validates and Fixes Typos --> AD[Art Director Agent]\n`;
    md += `    AD -- Generates visual metaphor scene descriptions --> Rep[Replicate Flux API]\n`;
    md += `    Rep -- Renders WebP Sketches --> Output[Final Slide deck with doodles]\n`;
    md += `\`\`\`\n\n`;

    md += `## 2. API Tracing Details\n\n`;
    md += `Below is a chronological log of all intercepted network requests made during the generation process.\n\n`;

    networkLogs.forEach((log, index) => {
        md += `### Request #${index + 1}: ${log.type} API\n`;
        md += `- **URL**: \`${log.url}\`\n`;
        md += `- **Method**: \`${log.method}\`\n`;
        md += `- **Response Status**: \`${log.status}\`\n`;
        md += `- **Duration**: \`${log.durationMs}ms\`\n\n`;

        md += `#### Outgoing Request Payload:\n`;
        md += `\`\`\`json\n${JSON.stringify(log.requestBody, null, 2)}\n\`\`\`\n\n`;

        md += `#### Incoming Response Payload:\n`;
        md += `\`\`\`json\n${JSON.stringify(log.responseBody, null, 2)}\n\`\`\`\n\n`;
        md += `---\n\n`;
    });

    md += `## 3. Analysis & Key Findings\n\n`;
    md += `Based on this pipeline audit, here is an analysis of each agent's behavior and the opportunities for optimization:\n\n`;

    md += `### 3.1 Research Agent\n`;
    md += `* **Observation**: The Research Agent performs a binary analysis of the input length/complexity and formats query parameters for Tavily. When strategy is \`EXPLORATORY\`, it triggers up to 3 parallel Tavily queries.\n`;
    md += `* **Improvement Opportunity**: The system prompt inside [researchPrompts.ts](file:///Users/sikandar/Desktop/projects/agentic-car/core/agents/prompts/researchPrompts.ts) asks the model to emit a JSON object matching strategy, reasoning, and search queries. The prompt is clean and concise, but it does not specify what makes a query high-quality for Tavily. Adding a rule asking the model to exclude search operators (like AND, OR) and generate queries optimized for natural language answers would return higher quality Tavily search matches.\n\n`;

    md += `### 3.2 Strategist Agent\n`;
    md += `* **Observation**: Takes the enriched search context and instructions, then maps them into a structural premise/takeaway. It is highly detailed and restricts itself to the mode specified in the brief.\n`;
    md += `* **Improvement Opportunity**: The strategist system prompt is quite large (approx 80 lines). Part of it contains template structures and instructions which are redundant. Using clean markdown block delimiters in the prompt structure can save tokens and reduce cost.\n\n`;

    md += `### 3.3 Template Agent\n`;
    md += `* **Observation**: Translates the strategist's output to final JSON slide content, matching specific constraints (e.g. hero and closing variants, output language, slide count).\n`;
    md += `* **Improvement Opportunity**: The template agent prompt includes a strict slide count guardrail. However, models occasionally fail when forced to generate exactly N slides for small topics or very long inputs (either cutting short or padding with low-quality content). We should implement a structured retry/correction check or a post-generation verification step inside the code if slide length doesn't match the requested count.\n\n`;

    md += `### 3.4 Proofreader Agent\n`;
    md += `* **Observation**: Proofreads in chunks of 4. This is highly effective at avoiding prompt-truncation issues on cheaper models, but it does mean multiple sequential LLM calls.\n`;
    md += `* **Improvement Opportunity**: For smaller slide decks (e.g. 5-7 slides), chunking by 4 creates 2 LLM requests. We could dynamically choose the chunk size based on total token budget or model context window (e.g., if Sonnet is used, pass all slides in a single request; if a cheap openrouter/free model is used, keep chunking).\n\n`;

    md += `### 3.5 Art Director & Replicate\n`;
    md += `* **Observation**: Generates prompts using a strict "ONE person + ONE oversized symbolic object + a physical action" formula. This creates highly consistent whiteboard sketches.\n`;
    md += `* **Improvement Opportunity**: The generated image URLs from Replicate are uploaded to Appwrite. If the download or upload fails, the system falls back to the Replicate URL. We should cache the generated images locally or reuse prompts if multiple slides have similar themes.\n\n`;

    md += `## 4. Proposed Upgrades for "Making the System Better"\n\n`;
    md += `1. **Structured Token Cache**: Introduce context caching on the Gemini API calls where we have repetitive system prompts.\n`;
    md += `2. **Query Refinement**: Update Tavily search query generation to produce cleaner search terms.\n`;
    md += `3. **Robust Retry logic**: If JSON parse fails, attempt a fast JSON-clean correction step instead of throwing a hard error.\n`;

    fs.writeFileSync(reportPath, md, 'utf-8');
    console.log(`✅ Audit report written successfully!`);
};

runAudit().catch(err => {
    console.error(`❌ Audit execution failed:`, err);
});
