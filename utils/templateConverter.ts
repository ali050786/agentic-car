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

export type AppTemplateType = 'template-1' | 'template-3' | 'template-4';
export type DbTemplateType = 'template1' | 'template3' | 'template4';

/**
 * Convert app template name to database template name
 * Example: 'template-1' → 'template1'
 */
export const appToDbTemplate = (appTemplate: AppTemplateType): DbTemplateType => {
  return appTemplate.replace('-', '') as DbTemplateType;
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

  // Add hyphen before the number
  const app = dbTemplate.replace(/(\d+)$/, '-$1');

  // Retired template: fall back to The Truth so legacy carousels still render.
  if (app === 'template-2') return 'template-1';

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
