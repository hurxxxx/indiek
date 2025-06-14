import { prisma } from '@/lib/prisma';
import { SongCard } from '@/components/song-card';

export default async function MusicPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  
  const songs = await prisma.song.findMany({
    where: { isActive: true },
    include: {
      artist: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Korean Indie Music
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Discover the latest tracks from talented Korean independent artists.
        </p>
      </div>

      {songs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No music found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {songs.map((song) => (
            <SongCard key={song.id} song={song} artist={song.artist} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
