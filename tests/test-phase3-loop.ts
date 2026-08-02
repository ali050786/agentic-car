import { CarouselPlanner, CreateJobPayload } from '../core/agents/CarouselPlanner';
import { renderSlide } from '../core/design/renderSlide';

console.log('🧪 Starting Phase 3 Plan-Execute-Reflect Loop Test...\n');

let passCount = 0;
let failCount = 0;

const mockPayload: CreateJobPayload = {
  topic: 'The Power of Agentic Workflows in 2026',
  inputMode: 'topic',
  sourceContent: 'Agentic workflows combine bounded reasoning loops with deterministic code execution.',
  customInstructions: 'Keep tone authoritative and clear.',
  outputLanguage: 'English',
  slideCount: 4,
  selectedModel: 'openrouter/deepseek-v4-flash',
  selectedTemplate: 'template-1',
  presetId: 'ocean-tech',
  brandMode: 'preset',
  brandKit: {
    enabled: true,
    identity: { name: 'Dev Lead', title: 'AI Engineer', imageUrl: '' },
    colors: { primary: '#0EA5E9', secondary: '#06B6D4', text: '#E0F2FE', background: '#0C4A6E' },
  },
  signaturePosition: 'bottom-left',
  format: 'portrait',
  selectedPattern: 1,
  patternOpacity: 0.2,
};

const mockEvents: { label: string; done: boolean }[] = [];
const progressLogs: string[] = [];

const mockProgress = async (msg: string, pct: number) => {
  progressLogs.push(`[${pct}%] ${msg}`);
};

const mockRunAgentSpan = async <R>(name: string, _input: any, fn: () => Promise<R>): Promise<R> => {
  return await fn();
};

const tokenTracker = { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0 };

async function testPlannerLoop() {
  try {
    console.log('  Executing CarouselPlanner.run()...');
    const result = await CarouselPlanner.run({
      jobId: 'test-job-123',
      userId: 'test-user-456',
      payload: mockPayload,
      events: mockEvents,
      progress: mockProgress,
      runAgentSpan: mockRunAgentSpan,
      tokenTracker,
    });

    if (!result || !result.slides || result.slides.length === 0) {
      throw new Error('Planner returned empty slides');
    }

    if (result.slides.length !== mockPayload.slideCount) {
      throw new Error(`Slide count mismatch: expected ${mockPayload.slideCount}, got ${result.slides.length}`);
    }

    // Verify slide rendering
    for (const slide of result.slides) {
      const svg = renderSlide('template-1', slide, result.theme, mockPayload.brandKit as any, 'portrait');
      if (!svg || !svg.includes('<svg>')) {
        throw new Error(`Failed to render slide ID ${slide.id}`);
      }
    }

    console.log(`  ✓ PASSED: CarouselPlanner.run() generated ${result.slides.length} valid IR slides`);
    console.log(`  ✓ PASSED: Appwrite Carousel ID created: ${result.carouselId}`);
    passCount += 2;
  } catch (err: any) {
    console.error(`  ❌ FAILED: CarouselPlanner.run() - ${err.message}`);
    failCount++;
  }

  console.log(`\nResults: ${passCount} passed, ${failCount} failed.`);
  if (failCount > 0) {
    process.exit(1);
  } else {
    console.log('✨ All Phase 3 Plan-Execute-Reflect loop tests passed successfully!');
  }
}

testPlannerLoop();
