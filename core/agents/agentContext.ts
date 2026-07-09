import { CreativeBrief } from '../../types';

/**
 * Shared input context passed to TemplateAgent (and read by MainAgent when
 * building it). Lives in its own file, separate from MainAgent.ts, because
 * MainAgent.ts also imports the browser-only Appwrite client — importing it
 * just for this type would drag that in for consumers (like the background
 * worker) that only need the type.
 */
export interface AgentContext {
    inputMode: 'topic' | 'text' | 'url' | 'video' | 'pdf';
    sourceContent: string;
    customInstructions?: string;
    outputLanguage: string;
    slideCount: number;
    viralAngle?: string;       // The Strategist's output (content spine/arc/angle)
    userMemory?: string[];     // Durable cross-carousel preferences (memoryService)
    creativeBrief?: CreativeBrief; // The Creative Director's intent brief
}

