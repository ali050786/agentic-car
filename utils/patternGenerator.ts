/**
 * Pattern Generator for Background Patterns
 * 
 * Generates randomized SVG pattern definitions for carousel backgrounds.
 * Supports 12 different pattern types with theme-aware colors.
 * Enhanced with larger sizes and better spacing for visibility.
 * 
 * Location: src/utils/patternGenerator.ts
 */

/**
 * Returns a random pattern number (1-12)
 */
export const getRandomPattern = (): number => {
  return Math.floor(Math.random() * 12) + 1;
};

/**
 * Generates SVG pattern definition based on pattern ID
 * 
 * @param patternId - Pattern identifier (1-12)
 * @returns Complete SVG <pattern> element string
 */
export const generatePatternSVG = (patternId: number): string => {
  const patterns: Record<number, string> = {
    // 1. Diagonal Lines (/) - Increased spacing and width
    1: `
      <pattern id="bgPattern" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
        <line x1="0" y1="30" x2="30" y2="0" stroke="var(--pattern-color)" stroke-width="2" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 2. Diagonal Lines (\) - Increased spacing and width
    2: `
      <pattern id="bgPattern" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="30" y2="30" stroke="var(--pattern-color)" stroke-width="2" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 3. Cross-hatch (Grid) - Larger grid with thicker lines
    3: `
      <pattern id="bgPattern" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
        <line x1="0" y1="30" x2="30" y2="0" stroke="var(--pattern-color)" stroke-width="1.5" opacity="var(--pattern-opacity)"/>
        <line x1="0" y1="0" x2="30" y2="30" stroke="var(--pattern-color)" stroke-width="1.5" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 4. Dots - Larger dots with more spacing
    4: `
      <pattern id="bgPattern" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
        <circle cx="15" cy="15" r="3" fill="var(--pattern-color)" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 5. Squares - Larger squares
    5: `
      <pattern id="bgPattern" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
        <rect x="10" y="10" width="10" height="10" fill="var(--pattern-color)" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 6. Plus Signs - Larger plus signs
    6: `
      <pattern id="bgPattern" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
        <line x1="15" y1="8" x2="15" y2="22" stroke="var(--pattern-color)" stroke-width="2" opacity="var(--pattern-opacity)"/>
        <line x1="8" y1="15" x2="22" y2="15" stroke="var(--pattern-color)" stroke-width="2" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 7. X Pattern (Crosses) - Larger X's
    7: `
      <pattern id="bgPattern" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
        <line x1="8" y1="8" x2="22" y2="22" stroke="var(--pattern-color)" stroke-width="2" opacity="var(--pattern-opacity)"/>
        <line x1="22" y1="8" x2="8" y2="22" stroke="var(--pattern-color)" stroke-width="2" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 8. Horizontal Stripes - Increased spacing and width
    8: `
      <pattern id="bgPattern" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
        <line x1="0" y1="15" x2="30" y2="15" stroke="var(--pattern-color)" stroke-width="2" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 9. Vertical Stripes - Increased spacing and width
    9: `
      <pattern id="bgPattern" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
        <line x1="15" y1="0" x2="15" y2="30" stroke="var(--pattern-color)" stroke-width="2" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 10. Triangles - Larger triangles
    10: `
      <pattern id="bgPattern" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
        <polygon points="15,8 22,20 8,20" fill="var(--pattern-color)" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 11. Hexagons (Honeycomb) - Larger hexagons with better spacing
    11: `
      <pattern id="bgPattern" x="0" y="0" width="42" height="36" patternUnits="userSpaceOnUse">
        <path d="M 21,3 L 30,9 L 30,21 L 21,27 L 12,21 L 12,9 Z" 
              fill="none" stroke="var(--pattern-color)" stroke-width="2" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 12. Waves - Larger, more pronounced waves
    12: `
      <pattern id="bgPattern" x="0" y="0" width="60" height="30" patternUnits="userSpaceOnUse">
        <path d="M 0,15 Q 15,8 30,15 T 60,15" 
              fill="none" stroke="var(--pattern-color)" stroke-width="2" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,
  };

  return patterns[patternId] || patterns[1]; // Default to diagonal lines if invalid ID
};

/**
 * Get a descriptive name for a pattern
 * 
 * @param patternId - Pattern identifier (1-12)
 * @returns Human-readable pattern name
 */
export const getPatternName = (patternId: number): string => {
  const names: Record<number, string> = {
    1: 'Diagonal Lines (/)',
    2: 'Diagonal Lines (\\)',
    3: 'Cross-hatch',
    4: 'Dots',
    5: 'Squares',
    6: 'Plus Signs',
    7: 'X Pattern',
    8: 'Horizontal Stripes',
    9: 'Vertical Stripes',
    10: 'Triangles',
    11: 'Hexagons',
    12: 'Waves',
  };

  return names[patternId] || 'Unknown Pattern';
};

/**
 * Generates Figma-compatible pattern as a rasterized PNG base64 image
 * This approach is much more efficient than rendering thousands of vector shapes.
 * Uses Canvas API to render the pattern and converts it to a PNG data URL.
 * 
 * @param patternId - Pattern identifier (1-12)
 * @param width - Canvas width
 * @param height - Canvas height
 * @param color - Pattern color (hex format)
 * @param opacity - Pattern opacity (0-1)
 * @returns Base64 PNG data URL
 */
export const generatePatternPNG = (
  patternId: number,
  width: number,
  height: number,
  color: string,
  opacity: string
): string => {
  // Create an offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    console.error('Failed to get canvas context');
    return '';
  }

  // Set pattern color and opacity
  const opacityValue = parseFloat(opacity);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = opacityValue;

  const tileSize = 30; // Base tile size for most patterns
  const cols = Math.ceil(width / tileSize) + 1;
  const rows = Math.ceil(height / tileSize) + 1;

  switch (patternId) {
    case 1: // Diagonal Lines (/)
      ctx.lineWidth = 2;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * tileSize;
          const y = row * tileSize;
          ctx.beginPath();
          ctx.moveTo(x, y + tileSize);
          ctx.lineTo(x + tileSize, y);
          ctx.stroke();
        }
      }
      break;

    case 2: // Diagonal Lines (\)
      ctx.lineWidth = 2;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * tileSize;
          const y = row * tileSize;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + tileSize, y + tileSize);
          ctx.stroke();
        }
      }
      break;

    case 3: // Cross-hatch
      ctx.lineWidth = 1.5;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * tileSize;
          const y = row * tileSize;
          ctx.beginPath();
          ctx.moveTo(x, y + tileSize);
          ctx.lineTo(x + tileSize, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + tileSize, y + tileSize);
          ctx.stroke();
        }
      }
      break;

    case 4: // Dots
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * tileSize + 15;
          const y = row * tileSize + 15;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;

    case 5: // Squares
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * tileSize + 10;
          const y = row * tileSize + 10;
          ctx.fillRect(x, y, 10, 10);
        }
      }
      break;

    case 6: // Plus Signs
      ctx.lineWidth = 2;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * tileSize + 15;
          const y = row * tileSize + 15;
          ctx.beginPath();
          ctx.moveTo(x, y - 7);
          ctx.lineTo(x, y + 7);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x - 7, y);
          ctx.lineTo(x + 7, y);
          ctx.stroke();
        }
      }
      break;

    case 7: // X Pattern
      ctx.lineWidth = 2;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * tileSize + 15;
          const y = row * tileSize + 15;
          ctx.beginPath();
          ctx.moveTo(x - 7, y - 7);
          ctx.lineTo(x + 7, y + 7);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + 7, y - 7);
          ctx.lineTo(x - 7, y + 7);
          ctx.stroke();
        }
      }
      break;

    case 8: // Horizontal Stripes
      ctx.lineWidth = 2;
      for (let row = 0; row < rows; row++) {
        const y = row * tileSize + 15;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      break;

    case 9: // Vertical Stripes
      ctx.lineWidth = 2;
      for (let col = 0; col < cols; col++) {
        const x = col * tileSize + 15;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      break;

    case 10: // Triangles
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * tileSize + 15;
          const y = row * tileSize + 15;
          ctx.beginPath();
          ctx.moveTo(x, y - 7);
          ctx.lineTo(x + 7, y + 5);
          ctx.lineTo(x - 7, y + 5);
          ctx.closePath();
          ctx.fill();
        }
      }
      break;

    case 11: // Hexagons
      const hexTileW = 42;
      const hexTileH = 36;
      const hexCols = Math.ceil(width / hexTileW) + 1;
      const hexRows = Math.ceil(height / hexTileH) + 1;
      ctx.lineWidth = 2;
      for (let row = 0; row < hexRows; row++) {
        for (let col = 0; col < hexCols; col++) {
          const x = col * hexTileW + 21;
          const y = row * hexTileH + 18;
          ctx.beginPath();
          ctx.moveTo(x, y - 12);
          ctx.lineTo(x + 9, y - 6);
          ctx.lineTo(x + 9, y + 6);
          ctx.lineTo(x, y + 12);
          ctx.lineTo(x - 9, y + 6);
          ctx.lineTo(x - 9, y - 6);
          ctx.closePath();
          ctx.stroke();
        }
      }
      break;

    case 12: // Waves
      const waveTileW = 60;
      const waveTileH = 30;
      const waveCols = Math.ceil(width / waveTileW) + 1;
      const waveRows = Math.ceil(height / waveTileH) + 1;
      ctx.lineWidth = 2;
      for (let row = 0; row < waveRows; row++) {
        for (let col = 0; col < waveCols; col++) {
          const x = col * waveTileW;
          const y = row * waveTileH + 15;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + 15, y - 7, x + 30, y);
          ctx.quadraticCurveTo(x + 45, y + 7, x + 60, y);
          ctx.stroke();
        }
      }
      break;

    default:
      // Default to diagonal lines
      ctx.lineWidth = 2;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * tileSize;
          const y = row * tileSize;
          ctx.beginPath();
          ctx.moveTo(x, y + tileSize);
          ctx.lineTo(x + tileSize, y);
          ctx.stroke();
        }
      }
  }

  // Convert canvas to PNG base64
  return canvas.toDataURL('image/png');
};
