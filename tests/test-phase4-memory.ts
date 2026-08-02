import { migrateMemory } from '../services/memoryService';
import { MemoryAgent } from '../core/agents/MemoryAgent';
import { StructuredMemory } from '../types';

console.log('🧪 Starting Phase 4 Structured Memory Verification Tests...\n');

let passCount = 0;
let failCount = 0;

// Test 1: Migration from legacy string[]
try {
  const legacyMemoryNotes = [
    'never use emojis',
    'banned: synergy',
    'always use high contrast brand colors',
    'prefers direct contrarian tone',
    'target audience is tech lead founders',
  ];

  const structured: StructuredMemory = migrateMemory(legacyMemoryNotes);

  if (!structured.bannedWords.includes('never use emojis') || !structured.bannedWords.includes('banned: synergy')) {
    throw new Error('Failed to classify banned words');
  }

  if (!structured.brandRules.includes('always use high contrast brand colors')) {
    throw new Error('Failed to classify brand rules');
  }

  if (!structured.tonePrefs.includes('prefers direct contrarian tone')) {
    throw new Error('Failed to classify tone preferences');
  }

  if (!structured.pastDecisions.includes('target audience is tech lead founders')) {
    throw new Error('Failed to classify past decisions');
  }

  console.log('  ✓ PASSED: Legacy string[] memory migration to StructuredMemory');
  passCount++;
} catch (err: any) {
  console.error(`  ❌ FAILED: Legacy Memory Migration - ${err.message}`);
  failCount++;
}

// Test 2: Structured memory round-trip object preservation
try {
  const mockStructuredObj: StructuredMemory = {
    brandRules: ['Use dark theme'],
    bannedWords: ['clickbait', 'guaranteed'],
    tonePrefs: ['contrarian'],
    pastDecisions: ['5 slides per carousel'],
  };

  const parsed = migrateMemory(mockStructuredObj);

  if (
    parsed.bannedWords.length !== 2 ||
    parsed.brandRules[0] !== 'Use dark theme' ||
    parsed.tonePrefs[0] !== 'contrarian'
  ) {
    throw new Error('Structured memory object parsing mismatch');
  }

  console.log('  ✓ PASSED: StructuredMemory object shape validation');
  passCount++;
} catch (err: any) {
  console.error(`  ❌ FAILED: StructuredMemory validation - ${err.message}`);
  failCount++;
}

console.log(`\nResults: ${passCount} passed, ${failCount} failed.`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('✨ All Phase 4 structured memory tests passed successfully!');
}
