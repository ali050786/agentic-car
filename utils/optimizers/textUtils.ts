/**
 * Helper to wrap text into SVG <tspan> elements for multi-line support.
 * Returns a string of <tspan> elements.
 */
export const getWrappedTextSpans = (text: string, maxWidth: number, fontSize: number, x: number, lineHeightEm: number = 1.2): { spans: string, lineCount: number } => {
  if (!text) return { spans: '', lineCount: 0 };
  
  // Approximate character width (0.6 is a common avg for sans-serif fonts)
  const avgCharWidth = fontSize * 0.55; 
  const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);
  
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    if (currentLine.length + 1 + words[i].length <= maxCharsPerLine) {
      currentLine += " " + words[i];
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);

  const spans = lines.map((line, i) => {
    // First line uses 'x', subsequent lines use 'x' and 'dy'
    const dy = i === 0 ? 0 : `${lineHeightEm}em`;
    return `<tspan x="${x}" dy="${dy}">${line}</tspan>`;
  }).join('');

  return { spans, lineCount: lines.length };
};