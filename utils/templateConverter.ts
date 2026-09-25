/**
 * Template Type Conversion Utility
 *
 * Converts between app template names (with hyphens) and database names (without)
 *
 * Location: src/utils/templateConverter.ts
 */

// App uses hyphenated names ('template-1'); the database uses unhyphenated
// ('template1'). Template 2 ("The Clarity") has been retired — any legacy
// 'template2' records are transparently mapped to 'template-1' on load.
//
// The Canvas (template-5) was retired. Canvas decks were stored as 'template1'
// plus theme.designMode = 'canvas'; they now open as The Truth in its own
// design, and the marker is dropped the next time they're saved (stampTheme).

import type { CarouselTheme } from '../types';

export type AppTemplateType = 'template-1' | 'template-3' | 'template-4';
export type DbTemplateType = 'template1' | 'template3' | 'template4';

/**
 * Convert app template name to database template name
 * Example: 'template-1' → 'template1'. Anything unknown (incl. the retired template-5) → 'template1'.
 */
export const appToDbTemplate = (appTemplate: AppTemplateType | string): DbTemplateType => {
  const db = String(appTemplate || 'template-1').replace('-', '');
  return (db === 'template3' || db === 'template4' ? db : 'template1') as DbTemplateType;
};

/** The theme as it must be saved: drops the retired Canvas marker. */
export const stampTheme = <T extends CarouselTheme | null | undefined>(theme: T, _appTemplate?: string): T => {
  if (!theme || typeof theme !== 'object' || !theme.designMode) return theme;
  const next = { ...theme } as CarouselTheme;
  delete next.designMode;
  return next as T;
};

/** Slides as they must be saved: drops layouts left by the retired Canvas (slide.design). */
export const withoutLayouts = <T,>(slides: T[]): T[] =>
  (slides || []).map((s: any) => {
    if (!s || typeof s !== 'object' || !('design' in s)) return s;
    const { design: _design, ...rest } = s;
    return rest as T;
  });

/** App template for a stored deck. Retired Canvas decks (designMode 'canvas') open as The Truth. */
export const resolveAppTemplate = (dbTemplate: string | null | undefined, _theme?: Partial<CarouselTheme> | string | null): AppTemplateType =>
  dbToAppTemplate(dbTemplate);

/**
 * Convert database template name to app template name
 * Example: 'template1' → 'template-1'. Retired 'template2' → 'template-1'.
 */
export const dbToAppTemplate = (dbTemplate: DbTemplateType | string | null | undefined): AppTemplateType => {
  // Handle undefined, null, or empty values
  if (!dbTemplate) {
    console.warn('dbToAppTemplate: received empty template, defaulting to template-1');
    return 'template-1';
  }

  // Add hyphen before the number (tolerates values that already have one)
  const app = dbTemplate.includes('-') ? dbTemplate : dbTemplate.replace(/(\d+)$/, '-$1');

  // Retired template: fall back to The Truth so legacy carousels still render.
  if (app === 'template-2') return 'template-1';
  // Retired Canvas (template-5) and anything unknown → The Truth.
  if (app !== 'template-1' && app !== 'template-3' && app !== 'template-4') return 'template-1';

  return app as AppTemplateType;
};

/**
 * Check if template is valid app template
 */
export const isValidAppTemplate = (template: string): template is AppTemplateType => {
  return template === 'template-1' || template === 'template-3' || template === 'template-4';
};

/**
 * Check if template is valid database template
 */
export const isValidDbTemplate = (template: string): template is DbTemplateType => {
  return template === 'template1' || template === 'template3' || template === 'template4';
};

/**
 * Get template display name
 */
export const getTemplateDisplayName = (template: AppTemplateType | DbTemplateType): string => {
  const normalized = template.replace('-', '');
  if (normalized === 'template1') return 'The Truth';
  if (normalized === 'template3') return 'The Sketch';
  if (normalized === 'template4') return 'The Statement';
  return 'The Truth';
};
