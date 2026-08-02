import { parseExplicitSlideCount, CreativeDirectorAgent } from '../core/agents/CreativeDirectorAgent';

console.log('🧪 Starting Slide Count Parsing & Intent Analysis Tests...\n');

let passCount = 0;
let failCount = 0;

// Test 1: Digit slide count extraction
const digitCases = [
  { input: 'Create a 5 slide carousel on AI', expected: 5 },
  { input: '12 pages about quantum computing', expected: 12 },
  { input: 'Make 3 cards on leadership', expected: 3 },
  { input: 'Create 20 slides deep dive', expected: 20 },
];

for (const c of digitCases) {
  const result = parseExplicitSlideCount(c.input);
  if (result === c.expected) {
    console.log(`  ✓ PASSED: "${c.input}" -> ${result}`);
    passCount++;
  } else {
    console.error(`  ❌ FAILED: "${c.input}" -> expected ${c.expected}, got ${result}`);
    failCount++;
  }
}

// Test 2: Word number slide count extraction
const wordCases = [
  { input: 'Create five slides on productivity', expected: 5 },
  { input: 'eight pages about remote work culture', expected: 8 },
  { input: 'three cards introducing GraphQL', expected: 3 },
  { input: 'ten slides explaining neural networks', expected: 10 },
  { input: 'fifteen slides comprehensive guide', expected: 15 },
];

for (const c of wordCases) {
  const result = parseExplicitSlideCount(c.input);
  if (result === c.expected) {
    console.log(`  ✓ PASSED: "${c.input}" -> ${result}`);
    passCount++;
  } else {
    console.error(`  ❌ FAILED: "${c.input}" -> expected ${c.expected}, got ${result}`);
    failCount++;
  }
}

// Test 3: Open-ended input with no slide count mentioned (should return null)
const openEndedInput = 'Create a carousel about UX design principles';
const openResult = parseExplicitSlideCount(openEndedInput);
if (openResult === null) {
  console.log(`  ✓ PASSED: "${openEndedInput}" -> null (no explicit count)`);
  passCount++;
} else {
  console.error(`  ❌ FAILED: "${openEndedInput}" -> expected null, got ${openResult}`);
  failCount++;
}

console.log(`\nResults: ${passCount} passed, ${failCount} failed.`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('✨ All slide count parsing & extraction tests passed successfully!');
}
