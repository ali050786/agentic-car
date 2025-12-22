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
 * Generates SVG pattern definition based on pattern ID, scale and spacing
 * 
 * @param patternId - Pattern identifier (1-12)
 * @param scale - Scale factor for pattern elements (default 1)
 * @param spacing - Spacing factor between pattern elements (default 1)
 * @returns Complete SVG <pattern> element string
 */
export const generatePatternSVG = (patternId: number, scale: number = 1, spacing: number = 1): string => {
  const size = 30 * spacing;
  const s = scale;

  const patterns: Record<number, string> = {
    // 1. Diagonal Lines (/)
    1: `
      <pattern id="bgPattern" x="0" y="0" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
        <line x1="0" y1="${size}" x2="${size}" y2="0" stroke="var(--pattern-color)" stroke-width="${2 * s}" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 2. Diagonal Lines (\)
    2: `
      <pattern id="bgPattern" x="0" y="0" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="${size}" y2="${size}" stroke="var(--pattern-color)" stroke-width="${2 * s}" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 3. Cross-hatch (Grid)
    3: `
      <pattern id="bgPattern" x="0" y="0" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
        <line x1="0" y1="${size}" x2="${size}" y2="0" stroke="var(--pattern-color)" stroke-width="${1.5 * s}" opacity="var(--pattern-opacity)"/>
        <line x1="0" y1="0" x2="${size}" y2="${size}" stroke="var(--pattern-color)" stroke-width="${1.5 * s}" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 4. Dots
    4: `
      <pattern id="bgPattern" x="0" y="0" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
        <circle cx="${size / 2}" cy="${size / 2}" r="${3 * s}" fill="var(--pattern-color)" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 5. Squares
    5: `
      <pattern id="bgPattern" x="0" y="0" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
        <rect x="${(size - 10 * s) / 2}" y="${(size - 10 * s) / 2}" width="${10 * s}" height="${10 * s}" fill="var(--pattern-color)" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 6. Plus Signs
    6: `
      <pattern id="bgPattern" x="0" y="0" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
        <line x1="${size / 2}" y1="${size / 2 - 7 * s}" x2="${size / 2}" y2="${size / 2 + 7 * s}" stroke="var(--pattern-color)" stroke-width="${2 * s}" opacity="var(--pattern-opacity)"/>
        <line x1="${size / 2 - 7 * s}" y1="${size / 2}" x2="${size / 2 + 7 * s}" y2="${size / 2}" stroke="var(--pattern-color)" stroke-width="${2 * s}" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 7. X Pattern (Crosses)
    7: `
      <pattern id="bgPattern" x="0" y="0" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
        <line x1="${size / 2 - 7 * s}" y1="${size / 2 - 7 * s}" x2="${size / 2 + 7 * s}" y2="${size / 2 + 7 * s}" stroke="var(--pattern-color)" stroke-width="${2 * s}" opacity="var(--pattern-opacity)"/>
        <line x1="${size / 2 + 7 * s}" y1="${size / 2 - 7 * s}" x2="${size / 2 - 7 * s}" y2="${size / 2 + 7 * s}" stroke="var(--pattern-color)" stroke-width="${2 * s}" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 8. Horizontal Stripes
    8: `
      <pattern id="bgPattern" x="0" y="0" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
        <line x1="0" y1="${size / 2}" x2="${size}" y2="${size / 2}" stroke="var(--pattern-color)" stroke-width="${2 * s}" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 9. Vertical Stripes
    9: `
      <pattern id="bgPattern" x="0" y="0" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
        <line x1="${size / 2}" y1="0" x2="${size / 2}" y2="${size}" stroke="var(--pattern-color)" stroke-width="${2 * s}" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 10. Triangles
    10: `
      <pattern id="bgPattern" x="0" y="0" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
        <polygon points="${size / 2},${size / 2 - 7 * s} ${size / 2 + 7 * s},${size / 2 + 5 * s} ${size / 2 - 7 * s},${size / 2 + 5 * s}" fill="var(--pattern-color)" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 11. Hexagons (Honeycomb)
    11: `
      <pattern id="bgPattern" x="0" y="0" width="${42 * spacing}" height="${36 * spacing}" patternUnits="userSpaceOnUse">
        <path d="M ${21 * spacing},${3 * spacing} L ${30 * spacing},${9 * spacing} L ${30 * spacing},${21 * spacing} L ${21 * spacing},${27 * spacing} L ${12 * spacing},${21 * spacing} L ${12 * spacing},${9 * spacing} Z" 
              fill="none" stroke="var(--pattern-color)" stroke-width="${2 * s}" opacity="var(--pattern-opacity)"/>
      </pattern>
    `,

    // 12. Waves
    12: `
      <pattern id="bgPattern" x="0" y="0" width="${60 * spacing}" height="${30 * spacing}" patternUnits="userSpaceOnUse">
        <path d="M 0,${15 * spacing} Q ${15 * spacing},${8 * spacing} ${30 * spacing},${15 * spacing} T ${60 * spacing},${15 * spacing}" 
              fill="none" stroke="var(--pattern-color)" stroke-width="${2 * s}" opacity="var(--pattern-opacity)"/>
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
 * 
 * @param patternId - Pattern identifier (1-12)
 * @param width - Canvas width
 * @param height - Canvas height
 * @param color - Pattern color (hex format)
 * @param opacity - Pattern opacity (0-1)
 * @param scale - Scale factor for pattern elements
 * @param spacing - Spacing factor between pattern elements
 * @returns Base64 PNG data URL
 */
export const generatePatternPNG = (
  patternId: number,
  width: number,
  height: number,
  color: string,
  opacity: string,
  scale: number = 1,
  spacing: number = 1
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

  const s = scale;
  const baseTileSize = 30;
  const tileSize = baseTileSize * spacing;

  const cols = Math.ceil(width / tileSize) + 1;
  const rows = Math.ceil(height / tileSize) + 1;

  switch (patternId) {
    case 1: // Diagonal Lines (/)
      ctx.lineWidth = 2 * s;
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
      ctx.lineWidth = 2 * s;
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
      ctx.lineWidth = 1.5 * s;
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
          const x = col * tileSize + tileSize / 2;
          const y = row * tileSize + tileSize / 2;
          ctx.beginPath();
          ctx.arc(x, y, 3 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;

    case 5: // Squares
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * tileSize + (tileSize - 10 * s) / 2;
          const y = row * tileSize + (tileSize - 10 * s) / 2;
          ctx.fillRect(x, y, 10 * s, 10 * s);
        }
      }
      break;

    case 6: // Plus Signs
      ctx.lineWidth = 2 * s;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * tileSize + tileSize / 2;
          const y = row * tileSize + tileSize / 2;
          ctx.beginPath();
          ctx.moveTo(x, y - 7 * s);
          ctx.lineTo(x, y + 7 * s);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x - 7 * s, y);
          ctx.lineTo(x + 7 * s, y);
          ctx.stroke();
        }
      }
      break;

    case 7: // X Pattern
      ctx.lineWidth = 2 * s;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * tileSize + tileSize / 2;
          const y = row * tileSize + tileSize / 2;
          ctx.beginPath();
          ctx.moveTo(x - 7 * s, y - 7 * s);
          ctx.lineTo(x + 7 * s, y + 7 * s);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + 7 * s, y - 7 * s);
          ctx.lineTo(x - 7 * s, y + 7 * s);
          ctx.stroke();
        }
      }
      break;

    case 8: // Horizontal Stripes
      ctx.lineWidth = 2 * s;
      for (let row = 0; row < rows; row++) {
        const y = row * tileSize + tileSize / 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      break;

    case 9: // Vertical Stripes
      ctx.lineWidth = 2 * s;
      for (let col = 0; col < cols; col++) {
        const x = col * tileSize + tileSize / 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      break;

    case 10: // Triangles
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * tileSize + tileSize / 2;
          const y = row * tileSize + tileSize / 2;
          ctx.beginPath();
          ctx.moveTo(x, y - 7 * s);
          ctx.lineTo(x + 7 * s, y + 5 * s);
          ctx.lineTo(x - 7 * s, y + 5 * s);
          ctx.closePath();
          ctx.fill();
        }
      }
      break;

    case 11: // Hexagons
      const hexTileW = 42 * spacing;
      const hexTileH = 36 * spacing;
      const hexCols = Math.ceil(width / hexTileW) + 1;
      const hexRows = Math.ceil(height / hexTileH) + 1;
      ctx.lineWidth = 2 * s;
      for (let row = 0; row < hexRows; row++) {
        for (let col = 0; col < hexCols; col++) {
          const x = col * hexTileW + 21 * spacing;
          const y = row * hexTileH + 18 * spacing;
          ctx.beginPath();
          ctx.moveTo(x, y - 12 * s);
          ctx.lineTo(x + 9 * s, y - 6 * s);
          ctx.lineTo(x + 9 * s, y + 6 * s);
          ctx.lineTo(x, y + 12 * s);
          ctx.lineTo(x - 9 * s, y + 6 * s);
          ctx.lineTo(x - 9 * s, y - 6 * s);
          ctx.closePath();
          ctx.stroke();
        }
      }
      break;

    case 12: // Waves
      const waveTileW = 60 * spacing;
      const waveTileH = 30 * spacing;
      const waveCols = Math.ceil(width / waveTileW) + 1;
      const waveRows = Math.ceil(height / waveTileH) + 1;
      ctx.lineWidth = 2 * s;
      for (let row = 0; row < waveRows; row++) {
        for (let col = 0; col < waveCols; col++) {
          const x = col * waveTileW;
          const y = row * waveTileH + 15 * spacing;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + 15 * spacing, y - 7 * s, x + 30 * spacing, y);
          ctx.quadraticCurveTo(x + 45 * spacing, y + 7 * s, x + 60 * spacing, y);
          ctx.stroke();
        }
      }
      break;

    default:
      // Default to diagonal lines
      ctx.lineWidth = 2 * s;
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
