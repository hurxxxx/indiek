'use client';

import { useI18n } from '@/components/i18n-provider';
import { SUPPORTED_LOCALES, LOCALE_LABELS, Locale } from '@/lib/i18n';

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  const handleLanguageChange = (newLocale: string) => {
    setLocale(newLocale as Locale);
  };

  return (
    <div className="relative">
      <select
        data-testid="language-switcher"
        value={locale}
        onChange={(e) => handleLanguageChange(e.target.value)}
        className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {SUPPORTED_LOCALES.map((lang) => (
          <option key={lang} value={lang}>
            {LOCALE_LABELS[lang]}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
        </svg>
      </div>
    </div>
  );
}
