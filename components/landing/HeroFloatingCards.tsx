import React, { useMemo, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { injectContentIntoSvg } from '../../utils/svgInjector';
import { resolveTheme } from '../../utils/brandUtils';
import { getPresetById } from '../../config/colorPresets';
import { SlideContent, TemplateId } from '../../types';

interface CardSpec {
    slide: SlideContent;
    x: number;
    y: number;
    z: number;
    rotateY: number;
    rotateX: number;
    rotateZ: number;
    delay: number;
}

// Real slides from three different templates — same SVG engine used in the
// editor, sidebar thumbnails, and PDF export. Not mockup boxes, and each card
// shows a different template + color preset so the variety is visible.
const SAMPLE_CARDS: { templateId: TemplateId; presetId: string; slide: SlideContent }[] = [
    {
        templateId: 'template-1', // Far Left
        presetId: 'sunset',
        slide: {
            id: 'demo-sunset',
            variant: 'hero',
            preHeader: 'SUNSET VIBES',
            headline: 'CRAFT DELIGHTFUL CAROUSELS.',
            body: 'Stand out from the noise with automated, stunning color combinations.',
            icon: 'Palette',
        },
    },
    {
        templateId: 'template-1', // Left
        presetId: 'ocean-tech',
        slide: {
            id: 'demo-truth',
            variant: 'hero',
            preHeader: 'AGENTIC AI',
            headline: 'STOP DESIGNING. START WRITING.',
            body: 'Your next carousel writes and designs itself while you do literally anything else.',
            icon: 'Sparkles',
        },
    },
    {
        templateId: 'template-4', // Center
        presetId: 'midnight',
        slide: {
            id: 'demo-statement',
            variant: 'closing',
            preHeader: 'READY?',
            headline: 'Your next move is one prompt away.',
            accentPhrase: 'one prompt away',
            body: 'Describe what you want to say. The rest is handled.',
            footer: 'Start free →',
            icon: 'ArrowRight',
        },
    },
    {
        templateId: 'template-1', // Right
        presetId: 'ocean-tech',
        slide: {
            id: 'demo-truth',
            variant: 'list',
            preHeader: 'HOW IT WORKS',
            headline: 'Three steps to viral.',
            accentPhrase: 'viral',
            listItems: ['Describe: Your topic in a sentence.', 'Generate: Agents write & design.', 'Export: Refine, then ship.'],
            icon: 'ListChecks',
        },
    },
    {
        templateId: 'template-3', // Far Right
        presetId: 'forest-light',
        slide: {
            id: 'demo-forest',
            variant: 'list',
            preHeader: 'ORGANIC GROWTH',
            headline: 'Grow your audience.',
            accentPhrase: 'audience',
            listItems: ['Quality: High-signal copy.', 'Palette: Harmonious color.', 'System: Consistent templates.'],
            icon: 'Zap',
        },
    },
];

const LAYOUT: Omit<CardSpec, 'slide'>[] = [
    { x: -280, y: 70, z: -150, rotateY: 38, rotateX: 14, rotateZ: -10, delay: 0 },
    { x: -140, y: 30, z: -70, rotateY: 24, rotateX: 8, rotateZ: -5, delay: 0.1 },
    { x: 20, y: -20, z: 80, rotateY: -12, rotateX: -4, rotateZ: 3, delay: 0.2 },
    { x: 180, y: 40, z: -40, rotateY: -28, rotateX: 6, rotateZ: 8, delay: 0.3 },
    { x: 320, y: 90, z: -110, rotateY: -40, rotateX: 12, rotateZ: 12, delay: 0.4 },
];

/** A single flat "slide" card — no 3D geometry, just a plane positioned/rotated in space. */
const FlatCard: React.FC<{ spec: CardSpec; svg: string; scopeClass: string }> = ({ spec, svg, scopeClass }) => {
    // Dynamically calculate scale based on depth to emphasize the 3D perspective
    const scale = spec.z < 0 ? 1 + (spec.z / 320) : 1;

    // Add custom depth of field blur if the card is recessed into the background (z < 0)
    let blurAmount = 'none';
    if (spec.z < 0) {
        const absZ = Math.abs(spec.z);
        // Far background cards (z < -100) are blurrier, standard background cards are subtle
        const factor = absZ > 100 ? 35 : 100;
        blurAmount = `blur(${Math.min(absZ / factor, 4.5)}px)`;
    }

    return (
        <motion.div
            className="absolute top-1/2 left-1/2 w-[260px] h-[332px] rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.6)] overflow-hidden border border-white/10"
            style={{
                x: '-50%',
                y: '-50%',
                translateX: spec.x,
                translateY: spec.y,
                translateZ: spec.z,
                rotateY: spec.rotateY,
                rotateX: spec.rotateX,
                rotateZ: spec.rotateZ,
                transformStyle: 'preserve-3d',
                filter: blurAmount,
            }}
            initial={{ opacity: 0, scale: 0.85 * scale }}
            animate={{
                opacity: 1,
                scale: scale,
                translateY: [spec.y - 10, spec.y + 10, spec.y - 10],
            }}
            transition={{
                opacity: { duration: 0.6, delay: spec.delay },
                scale: { duration: 0.6, delay: spec.delay },
                translateY: { duration: 5 + spec.delay * 4, repeat: Infinity, ease: 'easeInOut', delay: spec.delay },
            }}
        >
            <div className={`w-full h-full [&_svg]:w-full [&_svg]:h-full ${scopeClass}`} dangerouslySetInnerHTML={{ __html: svg }} />
        </motion.div>
    );
};

/**
 * Decorative hero visual — real slides rendered through the app's own SVG
 * template engine (utils/svgInjector.ts), positioned in 3D space via CSS
 * transforms (perspective + rotateX/Y/Z) rather than modeled 3D geometry.
 * Reacts to the cursor with a subtle parallax tilt on the whole group.
 */
export const HeroFloatingCards: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const pointerX = useMotionValue(0);
    const pointerY = useMotionValue(0);
    const springX = useSpring(pointerX, { stiffness: 60, damping: 20 });
    const springY = useSpring(pointerY, { stiffness: 60, damping: 20 });
    const groupRotateY = useTransform(springX, [-1, 1], [-12, 12]);
    const groupRotateX = useTransform(springY, [-1, 1], [10, -10]);

    const cards = useMemo(() => {
        return SAMPLE_CARDS.map(({ templateId, presetId, slide }, i) => {
            const preset = getPresetById(presetId);
            const theme = preset ? resolveTheme(preset.seeds, templateId) : null;
            const rawSvg = injectContentIntoSvg(templateId, slide, theme, undefined, 'portrait');
            const scopeClass = `hero-card-scope-${i}`;
            // injectContentIntoSvg emits its theme as `:root { --background: ... }`, which
            // always targets the *document* root — fine when only one themed SVG is on the
            // page, but with three different templates/presets here they'd all fight over
            // the same global CSS variables. Rescope each card's variables to its own subtree.
            // Also make SVG gradient & pattern IDs unique to prevent cross-card bleeding.
            const svg = rawSvg
                .replace(/:root/g, `.${scopeClass}`)
                .replace(/id="radial-gradient-hero"/g, `id="radial-gradient-hero-${i}"`)
                .replace(/url\(#radial-gradient-hero\)/g, `url(#radial-gradient-hero-${i})`)
                .replace(/id="bgPattern"/g, `id="bgPattern-${i}"`)
                .replace(/url\(#bgPattern\)/g, `url(#bgPattern-${i})`);
            return {
                spec: { ...LAYOUT[i], slide },
                svg,
                scopeClass,
            };
        });
    }, []);

    const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        pointerX.set(((e.clientX - rect.left) / rect.width) * 2 - 1);
        pointerY.set(((e.clientY - rect.top) / rect.height) * 2 - 1);
    };

    const onMouseLeave = () => {
        pointerX.set(0);
        pointerY.set(0);
    };

    return (
        <div
            ref={containerRef}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            className="relative w-full h-full"
            style={{ perspective: 900 }}
            aria-hidden="true"
        >
            <motion.div
                className="relative w-full h-full"
                style={{ transformStyle: 'preserve-3d', rotateY: groupRotateY, rotateX: groupRotateX }}
            >
                {cards.map(({ spec, svg, scopeClass }, i) => (
                    <FlatCard key={i} spec={spec} svg={svg} scopeClass={scopeClass} />
                ))}
            </motion.div>
        </div>
    );
};
