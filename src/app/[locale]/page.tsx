import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { HeroSection } from '@/components/hero-section';
import { FeaturedArtists } from '@/components/featured-artists';
import { LatestMusic } from '@/components/latest-music';

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return (
    <div className="min-h-screen">
      <HeroSection locale={locale} />
      <FeaturedArtists locale={locale} />
      <LatestMusic locale={locale} />
    </div>
  );
}
