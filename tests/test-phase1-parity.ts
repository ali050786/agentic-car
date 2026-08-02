import { injectContentIntoSvg } from '../utils/svgInjector';
import { SlideContent, CarouselTheme, BrandingConfig } from '../types';

const testTheme: CarouselTheme = {
  textDefault: '#E2E8F0',
  textHighlight: '#38BDF8',
  background: '#0F172A',
  background2: '#0284C7',
  patternColor: '#1E293B',
  patternOpacity: '0.2',
};

const testBranding: BrandingConfig = {
  enabled: true,
  name: 'Jane Doe',
  title: 'AI Researcher',
  imageUrl: 'https://example.com/avatar.jpg',
  position: 'bottom-left',
};

const sampleContent: Record<string, SlideContent> = {
  hero: {
    id: 'template-1-slide-0',
    variant: 'hero',
    preHeader: 'INNOVATION',
    headline: 'Building the Future of Autonomous Code',
    accentPhrase: 'Autonomous Code',
    body: 'How modern AI agents are transforming software engineering paradigms.',
  },
  body: {
    id: 'template-1-slide-1',
    variant: 'body',
    preHeader: 'THE PARADIGM SHIFT',
    headline: 'Why Bounded Reasoning Loops Win',
    body: 'Rather than running single-pass linear pipelines, bounded plan-execute-reflect loops deliver far higher reliability.',
  },
  list: {
    id: 'template-1-slide-2',
    variant: 'list',
    preHeader: 'CORE PILLARS',
    headline: 'Key Architectural Decisions',
    listItems: [
      'Deterministic Renderers: Never let raw LLM HTML hit production.',
      'Structured Memory: Distill user preferences and brand rules across runs.',
      'Single Model Focus: Consolidate model calls for optimal latency.',
    ],
  },
  closing: {
    id: 'template-1-slide-3',
    variant: 'closing',
    preHeader: 'CONCLUSION',
    headline: 'Ready to Transform Your Workflow?',
    body: 'Try out the new carousel agent architecture today.',
    footer: 'Follow for more insights →',
  },
};

const templates = ['template-1', 'template-3', 'template-4'];
const formats = ['portrait', 'square'] as const;
const variants = ['hero', 'body', 'list', 'closing'];

console.log('🧪 Starting Phase 1 Render Verification Test...\n');

let passCount = 0;
let failCount = 0;

for (const templateId of templates) {
  for (const format of formats) {
    for (const variant of variants) {
      const content = sampleContent[variant];
      try {
        const svg = injectContentIntoSvg(
          templateId,
          content,
          testTheme,
          testBranding,
          format,
          1,
          0.2,
          1,
          1,
          'test-id'
        );

        if (!svg || !svg.includes('<svg') || !svg.includes('</svg>')) {
          throw new Error('Output is missing valid <svg> wrapping');
        }

        if (!svg.includes('foreignObject')) {
          throw new Error('Output is missing <foreignObject> layout container');
        }

        if (!svg.includes('contenteditable="true"') || !svg.includes('data-edit-field=')) {
          throw new Error('Output is missing inline editable attributes (data-edit-field / contenteditable)');
        }

        console.log(`  ✓ PASSED: ${templateId} | ${format} | ${variant}`);
        passCount++;
      } catch (err: any) {
        console.error(`  ❌ FAILED: ${templateId} | ${format} | ${variant} - ${err.message}`);
        failCount++;
      }
    }
  }
}

console.log(`\nResults: ${passCount} passed, ${failCount} failed.`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('✨ All Phase 1 parity tests passed successfully!');
}
