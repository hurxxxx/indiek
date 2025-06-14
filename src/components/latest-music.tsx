'use client';

import Link from 'next/link';
import { useTranslation } from '@/hooks/use-translation';

export function LatestMusic() {
  const { t } = useTranslation();

  // Mock data - in real app, this would come from database
  const latestSongs = [
    {
      id: '1',
      title: 'Through the Night',
      artist: 'IU',
      youtubeUrl: 'https://www.youtube.com/watch?v=BzYnNdJhZQw',
      duration: '3:42',
    },
    {
      id: '2',
      title: 'Instagram',
      artist: 'Dean',
      youtubeUrl: 'https://www.youtube.com/watch?v=wKyMIrBClYw',
      duration: '3:26',
    },
    {
      id: '3',
      title: 'Star',
      artist: 'Heize',
      youtubeUrl: 'https://www.youtube.com/watch?v=XUR8QByF2As',
      duration: '4:12',
    },
  ];

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {t('home.latest_music')}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {latestSongs.map((song) => (
            <div key={song.id} className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {song.title}
              </h3>
              <p className="text-gray-600 mb-2">
                by {song.artist}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Duration: {song.duration}
              </p>
              <a
                href={song.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Play on YouTube
              </a>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link
            href="/music"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
          >
            {t('music.title')} →
          </Link>
        </div>
      </div>
    </section>
  );
}
