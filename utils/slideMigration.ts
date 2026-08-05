import { SlideContent, SlideLayout, BlockType, SlideVariant } from '../types';

/**
 * Slide Migration Adapter
 *
 * Provides bidirectional conversion between legacy `SlideContent` shapes and
 * the structured `SlideLayout` IR (Layout Intermediate Representation).
 * Guarantees backward compatibility for saved carousels in Appwrite.
 */

export const isSlideLayout = (item: any): item is SlideLayout => {
  return item && typeof item === 'object' && ('blockType' in item || 'slots' in item);
};

/** Map a legacy `variant` onto a block type. */
const variantToBlockType = (variant?: string): BlockType => {
  switch (variant) {
    case 'hero':
      return 'hero';
    case 'list':
      return 'list';
    case 'cta':
    case 'closing':
      return 'closing';
    case 'body':
    default:
      return 'body';
  }
};

export const slideToLayout = (item: SlideContent | SlideLayout): SlideLayout => {
  if (isSlideLayout(item)) {
    const raw = item as any;

    // A slide can be a *hybrid*: a legacy shape (top-level `headline`/`body`/
    // `listItems` + `variant`) that later gained a `slots` object — e.g. from an
    // inline edit — while a subsequent chat edit rewrote only the top-level
    // fields. The top-level fields are the source of truth those edit paths
    // write to, so a non-empty top-level value must win over a stale/empty slot;
    // slot-only fields (statNumber, quote, split…) pass through untouched.
    const src = item.slots || {};
    const has = (v: any) => v !== undefined && v !== null && !(typeof v === 'string' && v === '');
    const slots = {
      ...src,
      headline: has(raw.headline) ? raw.headline : src.headline,
      preHeader: has(raw.preHeader) ? raw.preHeader : src.preHeader,
      body: has(raw.body) ? raw.body : src.body,
      footer: has(raw.footer) ? raw.footer : src.footer,
      accentPhrase: has(raw.accentPhrase) ? raw.accentPhrase : src.accentPhrase,
      listItems: (Array.isArray(raw.listItems) && raw.listItems.length) ? raw.listItems : src.listItems,
    };

    return {
      id: item.id || `slide-${Date.now()}`,
      // Fall back to the legacy `variant` before defaulting — a hybrid slide
      // often carries `variant: 'list'` but no `blockType`, and defaulting
      // straight to 'body' silently drops its list rendering.
      blockType: item.blockType || variantToBlockType(raw.variant),
      slots,
      styleOverrides: item.styleOverrides,
      visual: item.visual,
    };
  }

  const legacy = item as SlideContent;
  const blockType: BlockType = variantToBlockType(legacy.variant);

  return {
    id: legacy.id || `slide-${Date.now()}`,
    blockType,
    slots: {
      headline: legacy.headline || '',
      preHeader: legacy.preHeader || '',
      body: legacy.body || '',
      listItems: legacy.listItems || [],
      footer: legacy.footer || '',
      accentPhrase: legacy.accentPhrase || undefined,
    },
    visual: {
      icon: legacy.icon,
      doodlePrompt: legacy.doodlePrompt,
      doodleUrl: legacy.doodleUrl,
    },
  };
};

export const layoutToSlide = (layout: SlideLayout): SlideContent => {
  let variant: SlideVariant = 'body';

  switch (layout.blockType) {
    case 'hero':
      variant = 'hero';
      break;
    case 'body':
    case 'stat':
    case 'quote':
    case 'split':
      variant = 'body';
      break;
    case 'list':
      variant = 'list';
      break;
    case 'cta':
    case 'closing':
      variant = 'closing';
      break;
    default:
      variant = 'body';
      break;
  }

  const headline = layout.slots?.headline || layout.slots?.statNumber || layout.slots?.splitLeft || '';
  const body = layout.slots?.body || layout.slots?.statLabel || layout.slots?.quoteAuthor || layout.slots?.splitRight || '';

  return {
    id: layout.id,
    variant,
    headline,
    preHeader: layout.slots?.preHeader,
    body,
    listItems: layout.slots?.listItems,
    footer: layout.slots?.footer,
    accentPhrase: layout.slots?.accentPhrase,
    icon: layout.visual?.icon,
    doodlePrompt: layout.visual?.doodlePrompt,
    doodleUrl: layout.visual?.doodleUrl,
  };
};
