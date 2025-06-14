'use client';

import Link from 'next/link';
import Image from 'next/image';

interface FeaturedArtistsProps {
  locale: string;
}

export function FeaturedArtists({ locale }: FeaturedArtistsProps) {

  // Mock data - in real app, this would come from database
  const featuredArtists = [
    {
      id: '1',
      name: 'IU',
      slug: 'iu',
      bio: 'Korean singer-songwriter and actress',
      image: '/placeholder-artist.jpg',
    },
    {
      id: '2',
      name: 'Dean',
      slug: 'dean',
      bio: 'R&B singer and songwriter',
      image: '/placeholder-artist.jpg',
    },
    {
      id: '3',
      name: 'Heize',
      slug: 'heize',
      bio: 'Hip-hop and R&B artist',
      image: '/placeholder-artist.jpg',
    },
  ];

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Featured Artists
          </h2>
          <Link
            href={`/${locale}/artists`}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            View All Artists →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featuredArtists.map((artist) => (
            <div key={artist.id} className="bg-gray-50 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow">
              <div className="aspect-square bg-gray-200 flex items-center justify-center">
                <span className="text-gray-500">Artist Photo</span>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {artist.name}
                </h3>
                <p className="text-gray-600 mb-4">
                  {artist.bio}
                </p>
                <Link
                  href={`/${locale}/artists/${artist.slug}`}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Learn More →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
