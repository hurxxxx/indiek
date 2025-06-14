'use client';

import { useI18n } from '@/components/i18n-provider';
import { t as translate, DEFAULT_LOCALE } from '@/lib/i18n';

export function useTranslation() {
  const { locale, isHydrated } = useI18n();

  // 하이드레이션 전에는 기본 언어 사용
  const currentLocale = isHydrated ? locale : DEFAULT_LOCALE;

  const t = (key: string) => translate(key, currentLocale);

  return { t, locale: currentLocale };
}
