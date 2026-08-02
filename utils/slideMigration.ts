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

export const slideToLayout = (item: SlideContent | SlideLayout): SlideLayout => {
  if (isSlideLayout(item)) {
    return {
      id: item.id || `slide-${Date.now()}`,
      blockType: item.blockType || 'body',
      slots: item.slots || {},
      styleOverrides: item.styleOverrides,
      visual: item.visual,
    };
  }

  const legacy = item as SlideContent;
  let blockType: BlockType = 'body';

  switch (legacy.variant) {
    case 'hero':
      blockType = 'hero';
      break;
    case 'body':
      blockType = 'body';
      break;
    case 'list':
      blockType = 'list';
      break;
    case 'cta':
    case 'closing':
      blockType = 'closing';
      break;
    default:
      blockType = 'body';
      break;
  }

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
