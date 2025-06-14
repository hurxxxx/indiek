'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Locale, DEFAULT_LOCALE, SUPPORTED_LOCALES, setLocale as setGlobalLocale } from '@/lib/i18n';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  isHydrated: boolean;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // 클라이언트에서만 로컬 스토리지 읽기
    const savedLocale = localStorage.getItem('locale') as Locale;
    if (savedLocale && SUPPORTED_LOCALES.includes(savedLocale)) {
      setLocaleState(savedLocale);
      setGlobalLocale(savedLocale);
    }
    setIsHydrated(true);

    // HTML lang 속성 초기 설정
    if (typeof document !== 'undefined') {
      document.documentElement.lang = savedLocale || DEFAULT_LOCALE;
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    if (SUPPORTED_LOCALES.includes(newLocale)) {
      setLocaleState(newLocale);
      setGlobalLocale(newLocale);

      // HTML lang 속성 업데이트
      if (typeof document !== 'undefined') {
        document.documentElement.lang = newLocale;
      }
    }
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, isHydrated }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
