/**
 * Template Type Conversion Utility
 * 
 * Converts between app template names (with hyphens) and database names (without)
 * 
 * Location: src/utils/templateConverter.ts
 */

// App uses: 'template-1' and 'template-2' (with hyphens)
// Database uses: 'template1' and 'template2' (without hyphens)

export type AppTemplateType = 'template-1' | 'template-2';
export type DbTemplateType = 'template1' | 'template2';

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
export const dbToAppTemplate = (dbTemplate: DbTemplateType): AppTemplateType => {
  // Add hyphen before the number
  return dbTemplate.replace(/(\d+)$/, '-$1') as AppTemplateType;
};

/**
 * Check if template is valid app template
 */
export const isValidAppTemplate = (template: string): template is AppTemplateType => {
  return template === 'template-1' || template === 'template-2';
};

/**
 * Check if template is valid database template
 */
export const isValidDbTemplate = (template: string): template is DbTemplateType => {
  return template === 'template1' || template === 'template2';
};

/**
 * Get template display name
 */
export const getTemplateDisplayName = (template: AppTemplateType | DbTemplateType): string => {
  const normalized = template.replace('-', '');
  return normalized === 'template1' ? 'The Truth' : 'The Clarity';
};