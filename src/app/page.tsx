import { HeroSection } from '@/components/hero-section';
import { FeaturedArtists } from '@/components/featured-artists';
import { LatestMusic } from '@/components/latest-music';

export default function Home() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <FeaturedArtists />
      <LatestMusic />
    </div>
  );
}
