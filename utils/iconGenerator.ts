import * as lucideIcons from 'lucide-static';

/**
 * Generates an SVG string for any Lucide icon.
 * Now supports ALL 1400+ Lucide icons dynamically using lucide-static!
 * 
 * @param iconName - The name of the Lucide icon in PascalCase (e.g., "Lightbulb", "Target", "Home", "Search")
 * @param size - Size of the icon in pixels
 * @param color - Color of the icon (CSS color value)
 * @returns SVG string or empty string if icon not found
 */
export const generateIconSVG = (
    iconName?: string,
    size: number = 80,
    color: string = '#141414'
): string => {
    if (!iconName) {
        return '';
    }

    try {
        // Icon should be 60% of circle size for proper visual padding
        const iconSize = size * 0.6;

        // lucide-static exports icons as ready-made SVG strings
        // Access the icon by name (PascalCase)
        const iconSvgString = (lucideIcons as any)[iconName];

        if (!iconSvgString || typeof iconSvgString !== 'string') {
            console.warn(`[iconGenerator] Icon "${iconName}" not found in Lucide library`);
            return '';
        }

        // The SVG string from lucide-static has default size 24x24 and uses currentColor
        // We need to modify it to use our size and color
        const modifiedSvg = iconSvgString
            .replace(/width="24"/, `width="${iconSize}"`)
            .replace(/height="24"/, `height="${iconSize}"`)
            .replace(/stroke="currentColor"/, `stroke="${color}"`);

        return modifiedSvg;
    } catch (error) {
        console.error(`[iconGenerator] Error generating icon "${iconName}":`, error);
        return '';
    }
};

/**
 * Get a list of all available icon names from Lucide
 */
export const getAvailableIcons = (): string[] => {
    // Filter out non-icon exports
    return Object.keys(lucideIcons).filter(key =>
        typeof (lucideIcons as any)[key] === 'string' && key !== 'default'
    );
};

/**
 * Get total count of available icons
 */
export const getIconCount = (): number => {
    return getAvailableIcons().length;
};
