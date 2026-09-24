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
// The Canvas (template-5) is stored as 'template1' plus theme.designMode =
// 'canvas': the templateType attribute only accepts the classic values, and a
// Canvas deck opened by an older client still renders (as The Truth). Always
// go through dbTemplateFor/stampTheme when saving and resolveAppTemplate when
// loading.

import type { CarouselTheme } from '../types';

export type AppTemplateType = 'template-1' | 'template-3' | 'template-4' | 'template-5';
export type DbTemplateType = 'template1' | 'template3' | 'template4';

/**
 * Convert app template name to database template name
 * Example: 'template-1' → 'template1'. The Canvas is stored as 'template1' (see above).
 */
export const appToDbTemplate = (appTemplate: AppTemplateType | string): DbTemplateType => {
  if (appTemplate === 'template-5') return 'template1';
  const db = String(appTemplate || 'template-1').replace('-', '');
  return (db === 'template3' || db === 'template4' ? db : 'template1') as DbTemplateType;
};

/** The theme as it must be saved for a template: carries the Canvas marker exactly when it's a Canvas deck. */
export const stampTheme = <T extends CarouselTheme | null | undefined>(theme: T, appTemplate: string): T => {
  if (!theme || typeof theme !== 'object') return theme;
  const canvas = appTemplate === 'template-5';
  if (canvas && theme.designMode === 'canvas') return theme;
  if (!canvas && !theme.designMode) return theme;
  const next = { ...theme } as CarouselTheme;
  if (canvas) next.designMode = 'canvas';
  else delete next.designMode;
  return next as T;
};

/** App template for a stored deck: the Canvas marker on the theme wins over templateType. */
export const resolveAppTemplate = (dbTemplate: string | null | undefined, theme?: Partial<CarouselTheme> | string | null): AppTemplateType => {
  let t: any = theme;
  if (typeof t === 'string') {
    try { t = JSON.parse(t); } catch { t = null; }
  }
  if (t && typeof t === 'object' && t.designMode === 'canvas') return 'template-5';
  return dbToAppTemplate(dbTemplate);
};

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
  if (app !== 'template-1' && app !== 'template-3' && app !== 'template-4' && app !== 'template-5') return 'template-1';

  return app as AppTemplateType;
};

/**
 * Check if template is valid app template
 */
export const isValidAppTemplate = (template: string): template is AppTemplateType => {
  return template === 'template-1' || template === 'template-3' || template === 'template-4' || template === 'template-5';
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
  if (template === 'template-5') return 'The Canvas';
  const normalized = template.replace('-', '');
  if (normalized === 'template1') return 'The Truth';
  if (normalized === 'template3') return 'The Sketch';
  if (normalized === 'template4') return 'The Statement';
  return 'The Truth';
};
