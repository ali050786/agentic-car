import { slideToLayout, layoutToSlide } from '../utils/slideMigration';
import { renderSlide } from '../core/design/renderSlide';
import { SlideContent, SlideLayout, CarouselTheme, BrandingConfig } from '../types';

const testTheme: CarouselTheme = {
  textDefault: '#F8FAFC',
  textHighlight: '#38BDF8',
  background: '#0F172A',
  background2: '#0284C7',
  patternColor: '#1E293B',
  patternOpacity: '0.2',
};

const testBranding: BrandingConfig = {
  enabled: true,
  name: 'Alex Rivera',
  title: 'Principal Architect',
  imageUrl: 'https://example.com/avatar.jpg',
  position: 'bottom-left',
};

console.log('🧪 Starting Phase 2 IR & Migration Verification Tests...\n');

let passCount = 0;
let failCount = 0;

// Test 1: Migration Adapter
try {
  const legacySlide: SlideContent = {
    id: 'legacy-slide-1',
    variant: 'hero',
    preHeader: 'LEGACY PREHEADER',
    headline: 'Legacy Carousel Headline',
    body: 'Legacy slide body content',
    icon: 'Lightbulb',
  };

  const migratedLayout = slideToLayout(legacySlide);
  if (migratedLayout.blockType !== 'hero' || migratedLayout.slots.headline !== 'Legacy Carousel Headline') {
    throw new Error('slideToLayout conversion failed');
  }

  const convertedBack = layoutToSlide(migratedLayout);
  if (convertedBack.variant !== 'hero' || convertedBack.headline !== 'Legacy Carousel Headline') {
    throw new Error('layoutToSlide conversion failed');
  }

  console.log('  ✓ PASSED: SlideContent <-> SlideLayout Migration Adapter');
  passCount++;
} catch (err: any) {
  console.error(`  ❌ FAILED: Migration Adapter - ${err.message}`);
  failCount++;
}

// Test 2: Render New IR Block Types (stat, quote, split)
const newBlockLayouts: SlideLayout[] = [
  {
    id: 'ir-stat-slide',
    blockType: 'stat',
    slots: {
      preHeader: 'GROWTH METRIC',
      headline: 'User Adoption Surge',
      statNumber: '+340%',
      statLabel: 'Year-over-year active user growth',
      body: 'Empirical verification across 12 product domains.',
    },
    visual: { icon: 'TrendingUp' },
  },
  {
    id: 'ir-quote-slide',
    blockType: 'quote',
    slots: {
      preHeader: 'EXPERT INSIGHT',
      headline: 'Architectural Philosophy',
      body: 'Simple systems that compose reliably will always defeat complex monoliths under stress.',
      quoteAuthor: 'Dr. Evelyn Vance',
    },
    visual: { icon: 'Brain' },
  },
  {
    id: 'ir-split-slide',
    blockType: 'split',
    slots: {
      preHeader: 'COMPARISON',
      headline: 'Linear Pipelines vs Bounded Loops',
      splitLeft: 'Linear: Rigid single-pass sequence with high failure cascading.',
      splitRight: 'Bounded Loop: Dynamic plan-execute-reflect iterations capped at N=2.',
    },
    visual: { icon: 'Layers' },
  },
];

const templates = ['template-1', 'template-3', 'template-4'];
const formats = ['portrait', 'square'] as const;

for (const templateId of templates) {
  for (const format of formats) {
    for (const layout of newBlockLayouts) {
      try {
        const svg = renderSlide(
          templateId,
          layout,
          testTheme,
          testBranding,
          format,
          1,
          0.2,
          1,
          1,
          'ir-test-id'
        );

        if (!svg || !svg.includes('<svg') || !svg.includes('</svg>')) {
          throw new Error(`Invalid SVG output for ${layout.blockType}`);
        }

        if (!svg.includes('foreignObject')) {
          throw new Error(`Missing foreignObject for ${layout.blockType}`);
        }

        if (!svg.includes('contenteditable="true"')) {
          throw new Error(`Missing contenteditable attributes for ${layout.blockType}`);
        }

        console.log(`  ✓ PASSED: ${templateId} | ${format} | IR Block [${layout.blockType}]`);
        passCount++;
      } catch (err: any) {
        console.error(`  ❌ FAILED: ${templateId} | ${format} | IR Block [${layout.blockType}] - ${err.message}`);
        failCount++;
      }
    }
  }
}

console.log(`\nResults: ${passCount} passed, ${failCount} failed.`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('✨ All Phase 2 IR verification tests passed successfully!');
}
