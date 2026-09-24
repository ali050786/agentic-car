import { SlideContent, SlideLayout, TemplateId, BrandingConfig } from '../../types';

/**
 * Sample content for the landing page. Every slide here is rendered through the
 * real production engine (core/design/renderSlide.ts), so what visitors see is
 * exactly what the product outputs, not a mockup.
 */

export type AnySlide = SlideContent | SlideLayout;

/** Stroke paths of the doodle, shared with the "sketching live" animation. */
export const DOODLE_PATHS: { d: string; w?: number; o?: number }[] = [
  { d: 'M60 520 C140 470 210 420 270 350 C320 292 360 230 400 150' },
  { d: 'M372 160 L402 146 L412 180' },
  { d: 'M58 522 L470 522' },
  { d: 'M90 522 L90 470 M150 522 L150 440 M210 522 L210 400 M270 522 L270 350 M330 522 L330 290', w: 3, o: 0.55 },
  { d: 'M214 306 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0' },
  { d: 'M236 328 L230 390 M232 350 L200 372 M232 348 L268 330 M230 390 L206 436 M230 390 L262 420 L256 452' },
  { d: 'M300 90 C300 60 340 44 362 64 C384 44 424 62 418 94 C440 100 440 136 414 140 L306 140 C282 138 280 100 300 90 Z', w: 4 },
  { d: 'M120 170 l0 26 M107 183 l26 0 M440 250 l0 20 M430 260 l20 0 M80 300 l0 18 M71 309 l18 0', w: 3.5 },
  { d: 'M170 250 C176 236 192 236 196 250', w: 3, o: 0.6 },
];

// A hand-drawn pencil sketch used for Template 3 ("The Sketch") demos. In the
// product this image comes from the Art Director agent + Flux on Replicate; here
// it is inlined so the landing page never depends on a network image.
const DOODLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 580" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${DOODLE_PATHS.map((p) => `<path d="${p.d}"${p.w ? ` stroke-width="${p.w}"` : ''}${p.o ? ` opacity="${p.o}"` : ''}/>`).join('')}</svg>`;

/** Transparent placeholder, so a slide can reserve the doodle slot while we draw it live. */
export const BLANK_DOODLE_URL = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 580"/>')}`;

export const DOODLE_URL = `data:image/svg+xml;utf8,${encodeURIComponent(DOODLE_SVG)}`;

// Initials avatar for the signature-card demo (brand kit).
const AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8cff"/><stop offset="1" stop-color="#9b6bff"/></linearGradient></defs><rect width="120" height="120" fill="url(#g)"/><text x="60" y="76" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="#fff" text-anchor="middle">YN</text></svg>`;
export const AVATAR_URL = `data:image/svg+xml;utf8,${encodeURIComponent(AVATAR_SVG)}`;

export const DEMO_BRANDING: BrandingConfig = {
  enabled: true,
  name: 'Your Name',
  title: 'Founder, Studio',
  imageUrl: AVATAR_URL,
  position: 'bottom-left',
};

/** The "building in public" deck used across the hero, pipeline and studio demos. */
export const DECK: AnySlide[] = [
  {
    id: 'bip-1',
    variant: 'hero',
    preHeader: 'BUILDING IN PUBLIC',
    headline: '7 lessons from 3 years of shipping in the open',
    accentPhrase: 'in the open',
    body: 'The stuff I wish someone had told me on day one.',
    icon: 'Rocket',
    doodleUrl: DOODLE_URL,
  },
  {
    id: 'bip-2',
    variant: 'list',
    preHeader: 'THE PLAYBOOK',
    headline: 'Consistency beats virality.',
    accentPhrase: 'Consistency',
    listItems: [
      'Cadence: Post on a rhythm you can keep.',
      'Proof: Show the work, not just the win.',
      'Replies: Your comments are a second feed.',
    ],
    icon: 'ListChecks',
    doodleUrl: DOODLE_URL,
  },
  {
    id: 'bip-3',
    blockType: 'stat',
    slots: {
      preHeader: 'THE LONG GAME',
      statNumber: 'Day 1,095',
      statLabel: 'the day it finally compounded',
      headline: 'Slow, then sudden.',
    },
    visual: { icon: 'TrendingUp', doodleUrl: DOODLE_URL },
  },
  {
    id: 'bip-4',
    blockType: 'quote',
    slots: {
      headline: 'Show your work. Then show it again, better.',
      quoteAuthor: 'A note to past me',
    },
    visual: { icon: 'Quote', doodleUrl: DOODLE_URL },
  },
  {
    id: 'bip-5',
    variant: 'closing',
    preHeader: 'YOUR TURN',
    headline: 'Start before you feel ready.',
    accentPhrase: 'before you feel ready',
    body: 'Follow for the next seven.',
    footer: 'Follow',
    icon: 'ArrowRight',
    doodleUrl: DOODLE_URL,
  },
];

export interface HeroCard {
  slide: AnySlide;
  templateId: TemplateId;
  presetId: string;
}

/** Five cards for the hero coverflow — three templates, five palettes. */
export const HERO_CARDS: HeroCard[] = [
  { slide: DECK[1], templateId: 'template-4', presetId: 'sunset-light' },
  { slide: DECK[2], templateId: 'template-1', presetId: 'neon-cyber' },
  { slide: DECK[0], templateId: 'template-1', presetId: 'ocean-tech' },
  { slide: DECK[3], templateId: 'template-4', presetId: 'midnight' },
  { slide: DECK[4], templateId: 'template-3', presetId: 'forest-light' },
];

/** A wider mix of content for the style wall marquee. */
export const WALL_SLIDES: AnySlide[] = [
  { id: 'w1', variant: 'hero', preHeader: 'PRICING', headline: '5 pricing mistakes early SaaS founders make', accentPhrase: 'pricing mistakes', body: 'Number 3 cost me a year.', icon: 'Tag', doodleUrl: DOODLE_URL },
  { id: 'w2', variant: 'list', preHeader: 'HIRING', headline: 'Hire for slope, not intercept.', accentPhrase: 'slope', listItems: ['Speed: How fast they learn.', 'Taste: What they refuse to ship.', 'Ownership: What they do unasked.'], icon: 'Users', doodleUrl: DOODLE_URL },
  { id: 'w3', blockType: 'stat', slots: { preHeader: 'FOCUS', statNumber: '1 ICP', statLabel: 'one customer, one channel, one message', headline: 'Narrow wins.' }, visual: { icon: 'Target', doodleUrl: DOODLE_URL } },
  { id: 'w4', blockType: 'quote', slots: { headline: 'Clarity is a growth strategy.', quoteAuthor: 'Field notes' }, visual: { icon: 'Quote', doodleUrl: DOODLE_URL } },
  { id: 'w5', variant: 'hero', preHeader: 'CAREER', headline: 'How to write a LinkedIn post people finish', accentPhrase: 'people finish', body: 'A framework in six slides.', icon: 'PenLine', doodleUrl: DOODLE_URL },
  { id: 'w6', variant: 'list', preHeader: 'AI AT WORK', headline: 'Delegate the draft, keep the judgment.', accentPhrase: 'judgment', listItems: ['Brief: Say what good looks like.', 'Review: Edit like an editor.', 'Ship: Done beats perfect.'], icon: 'Brain', doodleUrl: DOODLE_URL },
  { id: 'w7', variant: 'closing', preHeader: 'SAVE THIS', headline: 'Bookmark it for your next launch.', accentPhrase: 'next launch', body: 'Share it with a founder friend.', footer: 'Save', icon: 'Bookmark', doodleUrl: DOODLE_URL },
  { id: 'w8', blockType: 'stat', slots: { preHeader: 'HABITS', statNumber: '30 min', statLabel: 'a day of writing, every day', headline: 'Small, daily, boring.' }, visual: { icon: 'Clock', doodleUrl: DOODLE_URL } },
];

export const WALL_STYLES: { templateId: TemplateId; presetId: string }[] = [
  { templateId: 'template-1', presetId: 'ocean-tech' },
  { templateId: 'template-4', presetId: 'sunset-light' },
  { templateId: 'template-3', presetId: 'forest-light' },
  { templateId: 'template-4', presetId: 'midnight' },
  { templateId: 'template-1', presetId: 'golden-hour' },
  { templateId: 'template-3', presetId: 'ocean-tech-light' },
  { templateId: 'template-4', presetId: 'neon-cyber' },
  { templateId: 'template-1', presetId: 'midnight-light' },
];

export const TEMPLATES: { id: TemplateId; name: string; tagline: string; description: string }[] = [
  { id: 'template-1', name: 'The Truth', tagline: 'Bold · industrial · high contrast', description: 'Hard-hitting type, editorial serif accents and slide numbering built for thumb-stopping hooks.' },
  { id: 'template-3', name: 'The Sketch', tagline: 'Hand-drawn · narrative · warm', description: 'Whiteboard energy. The Art Director agent sketches a custom pencil doodle for every slide.' },
  { id: 'template-4', name: 'The Statement', tagline: 'Minimal · typographic · premium', description: 'Sentence-case headlines with a single highlighted phrase. Quiet confidence.' },
];
