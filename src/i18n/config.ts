export const locales = ['en', 'ko', 'es'] as const;
export const defaultLocale = 'en' as const;

export type Locale = typeof locales[number];
