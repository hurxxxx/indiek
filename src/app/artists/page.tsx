import { prisma } from '@/lib/prisma';
import { ArtistCard } from '@/components/artist-card';

export default async function ArtistsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  
  const artists = await prisma.artist.findMany({
    where: { isActive: true },
    include: {
      songs: {
        take: 3,
        orderBy: { createdAt: 'desc' }
      },
      _count: {
        select: { songs: true }
      }
    },
    orderBy: { name: 'asc' }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Korean Indie Artists
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Discover talented independent artists from Korea and explore their unique musical styles.
        </p>
      </div>

      {artists.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No artists found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {artists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
