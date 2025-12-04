/**
 * Example Usage of Design System
 * 
 * Demonstrates how to use color presets and brand utilities
 * to generate themes for carousels.
 * 
 * Location: src/config/exampleUsage.ts
 */

import { PRESETS, getPresetById } from './colorPresets';
import { generateScale, generateAllScales, resolveTheme } from '../utils/brandUtils';

// ============================================================================
// Example 1: Generate a single color scale
// ============================================================================

const primaryColor = '#3B82F6'; // Blue
const primaryScale = generateScale(primaryColor);

console.log('Single Scale Example:', primaryScale);
// Output:
// {
//   50: '#eff6ff',   // Lightest tint
//   100: '#dbeafe',
//   ...
//   500: '#3B82F6',  // Base color
//   ...
//   950: '#0a1929'   // Darkest shade
// }

// ============================================================================
// Example 2: Use a preset to generate all scales
// ============================================================================

const oceanPreset = getPresetById('ocean-tech');
if (oceanPreset) {
    const scales = generateAllScales(oceanPreset.seeds);

    console.log('Ocean Tech Scales:');
    console.log('Primary:', scales.primary);
    console.log('Secondary:', scales.secondary);
    console.log('Text:', scales.text);
    console.log('Surface:', scales.surface);
}

// ============================================================================
// Example 3: Generate Template 1 theme from a preset
// ============================================================================

const midnightPreset = getPresetById('midnight');
if (midnightPreset) {
    const template1Theme = resolveTheme(midnightPreset.seeds, 'template-1');

    console.log('Template 1 (The Truth) Theme:', template1Theme);
    // Output:
    // {
    //   background: '#...',       // surface[900] - Very dark
    //   textDefault: '#...',      // text[50] - Very light
    //   textHighlight: '#8B5CF6', // primary[500] - Vibrant purple
    //   background2: 'rgba(255, 255, 255, 0.1)' // Subtle overlay
    // }
}

// ============================================================================
// Example 4: Generate Template 2 theme from a preset
// ============================================================================

const sunsetPreset = getPresetById('sunset');
if (sunsetPreset) {
    const template2Theme = resolveTheme(sunsetPreset.seeds, 'template-2');

    console.log('Template 2 (The Clarity) Theme:', template2Theme);
    // Output:
    // {
    //   background: '#...',      // surface[950] - Almost black
    //   textDefault: '#...',     // text[50] - Very light
    //   textHighlight: '#...',   // secondary[400] - Lighter red
    //   background2: '#...',     // primary[800] - Dark orange
    //   bgGradStart: '#...',     // primary[900] - Very dark orange
    //   bgGradEnd: '#...'        // surface[950] - Match background
    // }
}

// ============================================================================
// Example 5: List all available presets
// ============================================================================

console.log('Available Presets:');
PRESETS.forEach(preset => {
    console.log(`- ${preset.name} (${preset.id}): ${preset.description}`);
});

// ============================================================================
// Example 6: Custom seeds (not from a preset)
// ============================================================================

const customSeeds = {
    primary: '#10B981',   // Emerald
    secondary: '#8B5CF6', // Purple
    text: '#F9FAFB',      // Off-white
    background: '#1F2937' // Dark gray
};

const customTheme = resolveTheme(customSeeds, 'template-1');
console.log('Custom Theme:', customTheme);

export {
    primaryScale,
    oceanPreset,
    midnightPreset,
    sunsetPreset,
    customSeeds,
    customTheme,
};
