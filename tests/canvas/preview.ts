/**
 * Renders the sample decks in every Canvas direction to one HTML page for
 * visual review. Open the file in a browser (fonts load from Google Fonts).
 *
 *   npx tsx tests/canvas/preview.ts [outDir] [--square] [--only=<direction>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { renderSlide } from '../../core/design/renderSlide';
import { designDeck, defaultStyle, DIRECTIONS, type Direction, type FontPairId } from '../../core/design/canvas';
import { canvasContentOf } from '../../core/design/canvas';
import { slideToLayout } from '../../utils/slideMigration';
import { resolveTheme } from '../../utils/brandUtils';
import { getPresetById } from '../../config/colorPresets';
import { FIT_SCRIPT } from '../../core/design/canvas/fit';
import { SAMPLE_DECKS } from './sampleDecks';

const outDir = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join('tests', 'canvas', 'out');
const square = process.argv.includes('--square');
const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];

const COMBOS: { direction: Direction; preset: string; deck: string; fonts?: FontPairId }[] = [
    { direction: 'bold', preset: 'midnight', deck: 'interview' },
    { direction: 'tech', preset: 'ocean-tech', deck: 'interview' },
    { direction: 'editorial', preset: 'sunset-light', deck: 'fourday' },
    { direction: 'corporate', preset: 'ocean-tech-light', deck: 'fourday' },
    { direction: 'playful', preset: 'midnight-light', deck: 'rain' },
    { direction: 'minimal', preset: 'forest-light', deck: 'interview' },
    { direction: 'magazine', preset: 'sunset', deck: 'fourday' },
    { direction: 'brutalist', preset: 'ocean-tech-light', deck: 'interview' },
];

const rows: string[] = [];
for (const combo of COMBOS) {
    if (only && combo.direction !== only) continue;
    const deck = SAMPLE_DECKS.find((d) => d.id === combo.deck)!;
    const preset = getPresetById(combo.preset) || getPresetById('ocean-tech')!;
    const theme = resolveTheme(preset.seeds, 'template-5');
    const style = defaultStyle(combo.direction, combo.fonts);
    const layouts = deck.slides.map((s, i) => slideToLayout({ id: `${deck.id}-${i}`, blockType: s.blockType, slots: s.slots, visual: s.visual } as any));
    const designs = designDeck(layouts.map((l) => ({ blockType: l.blockType, content: canvasContentOf(l) })), style, 7);
    const cells = layouts.map((l, i) => {
        const svg = renderSlide('template-5', { ...l, design: designs[i] } as any, theme, { enabled: true, name: 'Ali Abdul', title: 'Founder, Blinkwiser', imageUrl: '', position: 'bottom-left' }, square ? 'square' : 'portrait', 1, 0.1, 1, 1, `${combo.direction}-${i}`, i + 1, layouts.length);
        return `<div class="cell"><div class="slide ${square ? 'sq' : ''}">${svg}</div><div class="cap">${i + 1} · ${designs[i].archetype}</div></div>`;
    }).join('');
    rows.push(`<section><h2>${combo.direction} · ${preset.name} · ${style.fonts}</h2><div class="row">${cells}</div></section>`);
}

const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="fonts.css">
<style>
body{background:#0b0b10;color:#ddd;font-family:Inter,sans-serif;margin:24px}
h2{font-size:14px;font-weight:600;margin:28px 0 10px;color:#aaa}
.row{display:flex;gap:14px;flex-wrap:wrap}
.cell{width:300px}
.slide{width:300px;height:375px;border-radius:8px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.5)}
.slide.sq{height:300px}
.slide > svg{width:100%;height:100%;display:block}
.cap{font-size:11px;color:#777;margin-top:6px}
</style></head><body>${rows.join('')}<script>${FIT_SCRIPT}</script></body></html>`;

fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, square ? 'preview-square.html' : 'preview.html');
fs.writeFileSync(file, html);
console.log('wrote', file, `${(html.length / 1024).toFixed(0)} KB`);
