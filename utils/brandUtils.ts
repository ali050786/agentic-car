/**
 * Brand Utilities for Design System
 * 
 * Provides color scale generation and theme resolution.
 * Generates 11-step scales (50-950) from seed colors and maps them to templates.
 * 
 * Location: src/utils/brandUtils.ts
 */

import { colord, extend } from 'colord';
import mixPlugin from 'colord/plugins/mix';
import { CarouselTheme } from '../types';

// Extend colord with mix plugin
extend([mixPlugin]);

/**
 * Color scale type: maps step numbers to hex colors
 */
export type ColorScale = {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    950: string;
};

/**
 * Generate a complete color scale (50-950) from a seed color
 * 
 * Logic:
 * - 50-400: Tints (mix with white)
 * - 500: Base color (seed)
 * - 600-950: Shades (mix with black)
 * 
 * @param seedColor - Hex color string (e.g., '#3B82F6')
 * @returns ColorScale object with all steps
 */
export const generateScale = (seedColor: string): ColorScale => {
    const base = colord(seedColor);

    return {
        // Tints - lighter shades mixed with white
        50: base.mix('#FFFFFF', 0.95).toHex(),   // 95% white
        100: base.mix('#FFFFFF', 0.9).toHex(),   // 90% white
        200: base.mix('#FFFFFF', 0.75).toHex(),  // 75% white
        300: base.mix('#FFFFFF', 0.6).toHex(),   // 60% white
        400: base.mix('#FFFFFF', 0.3).toHex(),   // 30% white

        // Base color
        500: base.toHex(),

        // Shades - darker shades mixed with black
        600: base.mix('#000000', 0.3).toHex(),   // 30% black
        700: base.mix('#000000', 0.5).toHex(),   // 50% black
        800: base.mix('#000000', 0.7).toHex(),   // 70% black
        900: base.mix('#000000', 0.85).toHex(),  // 85% black
        950: base.mix('#000000', 0.93).toHex(),  // 93% black
    };
};

/**
 * Generate scales for all seed colors
 */
export const generateAllScales = (seeds: {
    primary: string;
    secondary: string;
    text: string;
    background: string;
}) => {
    return {
        primary: generateScale(seeds.primary),
        secondary: generateScale(seeds.secondary),
        text: generateScale(seeds.text),
        surface: generateScale(seeds.background), // Rename background to surface for clarity
    };
};

/**
 * Resolve theme colors based on template and seed colors
 * 
 * Maps color scales to CarouselTheme interface with template-specific logic.
 * 
 * @param seeds - Object with 4 seed colors (primary, secondary, text, background)
 * @param template - Template ID ('template-1' or 'template-2')
 * @returns CarouselTheme object ready for use
 */
export const resolveTheme = (
    seeds: {
        primary: string;
        secondary: string;
        text: string;
        background: string;
    },
    template: 'template-1' | 'template-2'
): CarouselTheme => {
    // Generate all color scales
    const scales = generateAllScales(seeds);

    // Detect if background is light or dark based on brightness (0-1)
    const bgBrightness = colord(seeds.background).brightness();
    const isLightMode = bgBrightness > 0.5; // > 0.5 = light background

    if (template === 'template-1') {
        // Template 1: "The Truth" - High Contrast, Industrial
        if (isLightMode) {
            return {
                background: scales.surface[50],            // Very light surface
                textDefault: scales.text[900],             // Very dark text
                textHighlight: scales.primary[600],        // Darker primary for contrast
                background2: scales.primary[400],        // Subtle dark overlay
            };
        } else {
            return {
                background: scales.surface[900],           // Very dark surface
                textDefault: scales.text[50],              // Very light text
                textHighlight: scales.primary[500],        // Vibrant primary for emphasis
                background2: `rgba(255, 255, 255, 0.1)`,   // Subtle white overlay
            };
        }
    } else {
        // Template 2: "The Clarity" - Gradients, Modern
        if (isLightMode) {
            return {
                background: scales.surface[50],            // Very light surface
                textDefault: scales.text[900],             // Very dark text
                textHighlight: scales.secondary[600],      // Darker secondary for accents
                background2: scales.primary[200],          // Light primary for architectural elements
                bgGradStart: scales.primary[400],          // Very light primary for gradient start
                bgGradEnd: scales.surface[50],             // Match main background for gradient end
            };
        } else {
            return {
                background: scales.surface[950],           // Almost black surface
                textDefault: scales.text[50],              // Very light text
                textHighlight: scales.secondary[400],      // Lighter secondary for accents
                background2: scales.primary[800],          // Dark primary for architectural elements
                bgGradStart: scales.primary[900],          // Very dark primary for gradient start
                bgGradEnd: scales.surface[950],            // Match main background for gradient end
            };
        }
    }
};

/**
 * Helper to get a readable name for a color scale step
 */
export const getScaleStepName = (step: keyof ColorScale): string => {
    const names: Record<keyof ColorScale, string> = {
        50: 'Lightest',
        100: 'Lighter',
        200: 'Light',
        300: 'Medium Light',
        400: 'Slightly Light',
        500: 'Base',
        600: 'Slightly Dark',
        700: 'Medium Dark',
        800: 'Dark',
        900: 'Darker',
        950: 'Darkest',
    };
    return names[step];
};

/**
 * Validate if a string is a valid hex color
 */
export const isValidHex = (color: string): boolean => {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
};
