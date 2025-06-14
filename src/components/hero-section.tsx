'use client';

import Link from 'next/link';
import { useTranslation } from '@/hooks/use-translation';

export function HeroSection() {
  const { t } = useTranslation();

  return (
    <section className="bg-gradient-to-r from-blue-600 to-purple-700 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            {t('home.title')}
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-blue-100 max-w-3xl mx-auto">
            {t('home.subtitle')}
          </p>
          <Link
            href="/artists"
            className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold text-lg hover:bg-blue-50 transition-colors"
          >
            {t('home.explore_button')}
          </Link>
        </div>
      </div>
    </section>
  );
}
