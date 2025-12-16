/**
 * Thumbnail Utility
 * 
 * Provides utilities for properly rendering SVG thumbnails with responsive sizing
 * and proper aspect ratio preservation.
 * 
 * Location: src/utils/thumbnailUtils.ts
 */

/**
 * Cleans and sanitizes an SVG string for use as a thumbnail preview.
 * 
 * This function:
 * - Removes any existing width/height attributes from the root <svg> tag
 * - Adds width="100%" and height="100%" for responsive sizing
 * - Adds preserveAspectRatio="xMidYMid meet" to ensure the content is:
 *   * Centered (xMidYMid)
 *   * Fully visible without cutoff (meet)
 *   * Properly scaled to fit the container
 * 
 * @param svgString - The raw SVG string to clean
 * @returns The sanitized SVG string ready for thumbnail rendering
 */
export function cleanSvgForPreview(svgString: string): string {
    // Remove existing width and height attributes from the root <svg> tag
    // This regex matches width="..." or height="..." and removes them
    let cleaned = svgString.replace(/\s*(width|height)="[^"]*"/gi, '');

    // Find the opening <svg tag and add our responsive attributes
    // We need to insert them before the closing > of the <svg tag
    cleaned = cleaned.replace(
        /<svg([^>]*?)>/i,
        (match, attributes) => {
            // Check if preserveAspectRatio already exists and remove it
            const cleanedAttributes = attributes.replace(/\s*preserveAspectRatio="[^"]*"/gi, '');

            // Add our responsive attributes
            return `<svg${cleanedAttributes} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`;
        }
    );

    return cleaned;
}
