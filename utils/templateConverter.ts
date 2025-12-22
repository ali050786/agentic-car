/**
 * Template Type Conversion Utility
 * 
 * Converts between app template names (with hyphens) and database names (without)
 * 
 * Location: src/utils/templateConverter.ts
 */

// App uses: 'template-1' and 'template-2' (with hyphens)
// Database uses: 'template1' and 'template2' (without hyphens)

export type AppTemplateType = 'template-1' | 'template-2' | 'template-3';
export type DbTemplateType = 'template1' | 'template2' | 'template3';

/**
 * Convert app template name to database template name
 * Example: 'template-1' → 'template1'
 */
export const appToDbTemplate = (appTemplate: AppTemplateType): DbTemplateType => {
  return appTemplate.replace('-', '') as DbTemplateType;
};

/**
 * Convert database template name to app template name
 * Example: 'template1' → 'template-1'
 */
export const dbToAppTemplate = (dbTemplate: DbTemplateType | string | null | undefined): AppTemplateType => {
  // Handle undefined, null, or empty values
  if (!dbTemplate) {
    console.warn('dbToAppTemplate: received empty template, defaulting to template-1');
    return 'template-1';
  }

  // Add hyphen before the number
  return dbTemplate.replace(/(\d+)$/, '-$1') as AppTemplateType;
};

/**
 * Check if template is valid app template
 */
export const isValidAppTemplate = (template: string): template is AppTemplateType => {
  return template === 'template-1' || template === 'template-2' || template === 'template-3';
};

/**
 * Check if template is valid database template
 */
export const isValidDbTemplate = (template: string): template is DbTemplateType => {
  return template === 'template1' || template === 'template2' || template === 'template3';
};

/**
 * Get template display name
 */
export const getTemplateDisplayName = (template: AppTemplateType | DbTemplateType): string => {
  const normalized = template.replace('-', '');
  if (normalized === 'template1') return 'The Truth';
  if (normalized === 'template2') return 'The Clarity';
  if (normalized === 'template3') return 'The Sketch';
  return 'The Truth';
};