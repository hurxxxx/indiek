'use client';

import { useParams, usePathname, useRouter } from 'next/navigation';
import { locales } from '@/i18n/config';

const languageNames = {
  en: 'English',
  ko: '한국어',
  es: 'Español'
};

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const currentLocale = params.locale as string;

  const handleLanguageChange = (newLocale: string) => {
    const newPathname = pathname.replace(`/${currentLocale}`, `/${newLocale}`);
    router.push(newPathname);
  };

  return (
    <div className="relative">
      <select
        value={currentLocale}
        onChange={(e) => handleLanguageChange(e.target.value)}
        className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {languageNames[locale]}
          </option>
        ))}
      </select>
    </div>
  );
}
