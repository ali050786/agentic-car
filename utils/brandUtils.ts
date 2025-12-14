import { colord, extend } from 'colord';
import mixPlugin from 'colord/plugins/mix';
import { CarouselTheme } from '../types';

extend([mixPlugin]);

/**
 * Generate color scale from a single seed color.
 * Returns an object with palette keys (50-950).
 */
export const generateColorScale = (seedColor: string) => {
    const base = colord(seedColor);

    return {
        50: base.lighten(0.45).toHex(),
        100: base.lighten(0.36).toHex(),
        200: base.lighten(0.27).toHex(),
        300: base.lighten(0.18).toHex(),
        400: base.lighten(0.09).toHex(),
        500: base.toHex(), // Original seed color
        600: base.darken(0.09).toHex(),
        700: base.darken(0.18).toHex(),
        800: base.darken(0.27).toHex(),
        900: base.darken(0.36).toHex(),
        950: base.darken(0.45).toHex(),
    };
};

/**
 * Generates all color scales from seeds
 */
export const generateAllScales = (seeds: {
    primary: string;
    secondary: string;
    text: string;
    background: string;
}) => {
    return {
        primary: generateColorScale(seeds.primary),
        secondary: generateColorScale(seeds.secondary),
        text: generateColorScale(seeds.text),
        surface: generateColorScale(seeds.background),
    };
};

/**
 * Calculate pattern color (white for dark themes, black for light themes)
 * 
 * @param backgroundColor - Background color hex string
 * @returns Pattern color hex string (white or black)
 */
export const calculatePatternColor = (backgroundColor: string): string => {
    const bg = colord(backgroundColor);
    const brightness = bg.brightness();

    // Dark background (< 0.5): use white
    // Light background (>= 0.5): use black
    return brightness < 0.5 ? '#FFFFFF' : '#000000';
};

/**
 * Calculate pattern opacity based on theme brightness
 * 
 * @param backgroundColor - Background color hex string
 * @returns Pattern opacity string ('0.2' for both dark and light)
 */
export const calculatePatternOpacity = (backgroundColor: string): string => {
    // 20% opacity for both dark and light themes
    return '0.2';
};

/**
 * Resolves theme based on color seeds and template type
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
    // Detect if dark or light theme
    const brightness = colord(seeds.background).brightness();
    const isDark = brightness < 0.5;

    // For dark themes, darken background by 27% (800 scale)
    const finalBackground = isDark
        ? colord(seeds.background).darken(0.27).toHex()
        : seeds.background;

    const patternColor = calculatePatternColor(finalBackground);
    const patternOpacity = calculatePatternOpacity(finalBackground);

    if (template === 'template-1') {
        // Calculate background2 based on secondary color
        // For dark themes: lighten secondary by 25%
        // For light themes: darken secondary by 15%
        const background2 = isDark
            ? colord(seeds.secondary).lighten(0.25).toHex()
            : colord(seeds.secondary).darken(0.15).toHex();

        return {
            textDefault: seeds.text,
            textHighlight: seeds.primary,
            background: finalBackground,
            background2: background2,
            patternColor,
            patternOpacity,
        };
    }

    // Template 2
    const gradStart = seeds.secondary;
    const gradEnd = finalBackground;

    // Calculate button color based on primary
    // For dark themes: lighten primary by 25%
    // For light themes: darken primary by 15%
    const buttonColor = isDark
        ? colord(seeds.primary).lighten(0.25).toHex()
        : colord(seeds.primary).darken(0.15).toHex();

    return {
        background: finalBackground,
        textHighlight: seeds.primary,
        background2: seeds.secondary,
        buttonColor: buttonColor,
        textDefault: seeds.text,
        bgGradStart: gradStart,
        bgGradEnd: gradEnd,
        patternColor,
        patternOpacity,
    };
};

/**
 * Helper to get a readable name for a color scale step
 */
export const getScaleName = (step: number): string => {
    const names: Record<number, string> = {
        50: 'Lightest',
        100: 'Very Light',
        200: 'Light',
        300: 'Light Medium',
        400: 'Medium Light',
        500: 'Base',
        600: 'Medium Dark',
        700: 'Dark Medium',
        800: 'Dark',
        900: 'Very Dark',
        950: 'Darkest',
    };
    return names[step] || `Step ${step}`;
};
