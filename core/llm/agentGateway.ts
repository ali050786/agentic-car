/**
 * Node-side replacement for services/aiService.ts's generateContentFromAgent,
 * used when core/agents/*.ts run inside the background worker instead of the
 * browser. The agent files themselves are unmodified — they only ever call
 * generateContentFromAgent(prompt, schema) — so the per-call context (which
 * user, which model, BYOK or system keys) is threaded through AsyncLocalStorage
 * instead of being read from a Zustand store.
 *
 * services/aiService.ts checks `typeof window === 'undefined'` and delegates
 * here so this module is only ever imported under Node.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { generateContent } from './generateContent';
import { assertAndConsumeFreeTier } from '../../lib/freeTierServer';

export interface AuditLogEntry {
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

export interface AgentJobContext {
    userId: string;
    selectedModel: string;
    tokenTracker?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        cachedTokens: number;
    };
    auditLogs?: AuditLogEntry[];
}

const storage = new AsyncLocalStorage<AgentJobContext>();

async function writeLatestAuditReport(logs: AuditLogEntry[], tokenTracker?: any) {
    try {
        const reportPath = path.resolve(process.cwd(), 'latest_carousel_audit.md');
        let md = `# Latest Carousel Generation Audit Report\n\n`;
        md += `- **Timestamp**: ${new Date().toISOString()}\n`;
        if (tokenTracker) {
            md += `- **Tokens Consumed**: Prompt: ${tokenTracker.promptTokens}, Completion: ${tokenTracker.completionTokens}, Total: ${tokenTracker.totalTokens}\n`;
        }
        md += `\n---\n\n`;

        logs.forEach((log, index) => {
            md += `### Trace #${index + 1}: ${log.type} Request\n`;
            md += `- **URL**: \`${log.url}\`\n`;
            md += `- **Method**: \`${log.method}\`\n`;
            md += `- **Status**: \`${log.status}\`\n`;
            md += `- **Duration**: \`${log.durationMs}ms\`\n\n`;

            md += `#### Outgoing Request Payload:\n`;
            md += `\`\`\`json\n${JSON.stringify(log.requestBody, null, 2)}\n\`\`\`\n\n`;

            md += `#### Incoming Response Payload:\n`;
            md += `\`\`\`json\n${JSON.stringify(log.responseBody, null, 2)}\n\`\`\`\n\n`;
            md += `---\n\n`;
        });

        await fs.promises.writeFile(reportPath, md, 'utf-8');
        console.log(`[Audit] Successfully saved audit trail of ${logs.length} calls to ${reportPath}`);
    } catch (err) {
        console.error('[Audit] Error writing latest audit report:', err);
    }
}

// Global fetch interceptor to capture all pings during an active job
const originalFetch = globalThis.fetch;
globalThis.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
    const ctx = storage.getStore();
    if (!ctx || !ctx.auditLogs) {
        return originalFetch(input, init);
    }

    const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
    const method = init?.method || 'GET';
    const headers = init?.headers ? { ...init.headers } : {};

    // Redact credentials
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

    const type = url.includes('tavily') ? 'TAVILY' : (url.includes('replicate') ? 'REPLICATE' : 'LLM');

    const logEntry: AuditLogEntry = {
        timestamp: new Date().toISOString(),
        type,
        url,
        method,
        requestHeaders: loggedHeaders,
        requestBody
    };

    ctx.auditLogs.push(logEntry);
    const startTime = Date.now();

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
            logEntry.responseBody = `[Failed to parse response body: ${e}]`;
        }
        return response;
    } catch (err: any) {
        logEntry.durationMs = Date.now() - startTime;
        logEntry.status = 0;
        logEntry.responseBody = `[Network Error: ${err?.message || err}]`;
        throw err;
    }
};

/** Wraps a job's execution so every generateContentFromAgent call inside sees this context. */
export const runWithAgentContext = <T>(ctx: AgentJobContext, fn: () => Promise<T>): Promise<T> => {
    // Automatically attach auditLogs collector
    if (!ctx.auditLogs) {
        ctx.auditLogs = [];
    }

    return storage.run(ctx, async () => {
        try {
            const result = await fn();
            return result;
        } finally {
            if (ctx.auditLogs && ctx.auditLogs.length > 0) {
                // Write the audit trail and wait for it
                await writeLatestAuditReport(ctx.auditLogs, ctx.tokenTracker).catch(err => {
                    console.error('[agentGateway] Background write for audit failed:', err);
                });
            }
        }
    });
};

export const generateContentFromAgentServer = async (prompt: string, _responseSchema: any) => {
    const ctx = storage.getStore();
    if (!ctx) {
        throw new Error('generateContentFromAgentServer called outside of runWithAgentContext — no job context available');
    }

    await assertAndConsumeFreeTier(ctx.userId);

    return generateContent({
        prompt,
        selectedModel: ctx.selectedModel,
        systemKeys: {
            anthropic: process.env.CLAUDE_API_KEY,
            openrouter: process.env.OPENROUTER_API_KEY,
            groq: process.env.GROQ_API_KEY,
        },
        onTokenUsage: (usage) => {
            if (ctx.tokenTracker) {
                ctx.tokenTracker.promptTokens += usage.promptTokens;
                ctx.tokenTracker.completionTokens += usage.completionTokens;
                ctx.tokenTracker.totalTokens += usage.totalTokens;
                ctx.tokenTracker.cachedTokens += usage.cachedTokens;
            }
        }
    });
};
