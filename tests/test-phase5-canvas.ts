import { useCarouselStore } from '../store/useCarouselStore';
import { renderSlide } from '../core/design/renderSlide';
import { SlideLayout, CarouselTheme, BrandingConfig } from '../types';

console.log('🧪 Starting Phase 5 React Canvas & Single Source Store Verification Tests...\n');

let passCount = 0;
let failCount = 0;

const initialSlideLayout: SlideLayout = {
  id: 'slide-test-5',
  blockType: 'stat',
  slots: {
    preHeader: 'METRIC REPORT',
    headline: 'Performance Benchmark',
    statNumber: '99.9%',
    statLabel: 'Uptime reliability SLA across 500 nodes',
    body: 'Automated monitoring ensures continuous availability.',
  },
  visual: { icon: 'Zap' },
};

const testTheme: CarouselTheme = {
  textDefault: '#F8FAFC',
  textHighlight: '#38BDF8',
  background: '#0F172A',
  background2: '#0284C7',
};

const testBranding: BrandingConfig = {
  enabled: true,
  name: 'Dev Lead',
  title: 'Principal Engineer',
  imageUrl: '',
  position: 'bottom-left',
};

// Test 1: Store updateSlide with SlideLayout slots
try {
  useCarouselStore.setState({
    slides: [initialSlideLayout],
    theme: testTheme,
    selectedTemplate: 'template-1',
    selectedFormat: 'portrait',
  });

  const storeStateBefore = useCarouselStore.getState();
  if (storeStateBefore.slides.length !== 1) {
    throw new Error('Initial store slides assignment failed');
  }

  // Perform slot update
  useCarouselStore.getState().updateSlide(0, {
    statNumber: '99.999%',
    statLabel: 'Five Nines Uptime SLA',
  });

  const updatedSlide = useCarouselStore.getState().slides[0] as SlideLayout;

  if (updatedSlide.slots.statNumber !== '99.999%' || updatedSlide.slots.statLabel !== 'Five Nines Uptime SLA') {
    throw new Error('updateSlide failed to update SlideLayout slots');
  }

  console.log('  ✓ PASSED: Store updateSlide updates SlideLayout slots natively');
  passCount++;
} catch (err: any) {
  console.error(`  ❌ FAILED: Store updateSlide - ${err.message}`);
  failCount++;
}

// Test 2: Store updateSlideSlot action
try {
  useCarouselStore.getState().updateSlideSlot!(0, 'statLabel', 'Five Nines Real-Time Edge Telemetry');
  const slide = useCarouselStore.getState().slides[0] as SlideLayout;

  if (slide.slots.statLabel !== 'Five Nines Real-Time Edge Telemetry') {
    throw new Error('updateSlideSlot failed');
  }

  console.log('  ✓ PASSED: Store updateSlideSlot action works');
  passCount++;
} catch (err: any) {
  console.error(`  ❌ FAILED: updateSlideSlot - ${err.message}`);
  failCount++;
}

// Test 3: renderSlide consuming updated SlideLayout cleanly
try {
  const currentSlide = useCarouselStore.getState().slides[0] as SlideLayout;
  const svg = renderSlide(
    'template-1',
    currentSlide,
    testTheme,
    testBranding,
    'portrait',
    1,
    0.2,
    1,
    1,
    'canvas-test'
  );

  if (!svg.includes('99.999%') || !svg.includes('Five Nines Real-Time Edge Telemetry')) {
    throw new Error('renderSlide output does not contain updated slot values');
  }

  console.log('  ✓ PASSED: renderSlide reflects canvas slot updates natively');
  passCount++;
} catch (err: any) {
  console.error(`  ❌ FAILED: renderSlide canvas update - ${err.message}`);
  failCount++;
}

console.log(`\nResults: ${passCount} passed, ${failCount} failed.`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('✨ All Phase 5 React Canvas & Single Source Store tests passed successfully!');
}
