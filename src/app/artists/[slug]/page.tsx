import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { SongCard } from '@/components/song-card';
import { generateMetadata as generateMeta, generateArtistStructuredData } from '@/lib/metadata';

interface ArtistPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  const { locale, slug } = await params;

  const artist = await prisma.artist.findUnique({
    where: { slug },
    select: {
      name: true,
      bio: true,
      image: true,
    }
  });

  if (!artist) {
    return {
      title: 'Artist Not Found',
      description: 'The requested artist could not be found.'
    };
  }

  return generateMeta({
    title: artist.name,
    description: artist.bio || `Discover music by ${artist.name}, a talented Korean indie artist.`,
    locale,
    image: artist.image || '/og-artist.jpg',
    type: 'profile'
  });
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { locale, slug } = await params;

  const artist = await prisma.artist.findUnique({
    where: { slug },
    include: {
      songs: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      },
      posts: {
        where: { isPublished: true },
        orderBy: { publishedAt: 'desc' },
        take: 5
      }
    }
  });

  if (!artist) {
    notFound();
  }

  const structuredData = generateArtistStructuredData(artist);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Artist Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-700 rounded-lg p-8 mb-12 text-white">
          <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
            <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-4xl font-bold">
                {artist.name.charAt(0)}
              </span>
            </div>

            <div className="flex-1 text-center md:text-left">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                {artist.name}
              </h1>

              {artist.bio && (
                <p className="text-xl text-blue-100 mb-6 max-w-3xl">
                  {artist.bio}
                </p>
              )}

              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                {artist.website && (
                  <a
                    href={artist.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
                  >
                    Website
                  </a>
                )}

                {artist.instagram && (
                  <a
                    href={artist.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
                  >
                    Instagram
                  </a>
                )}

                {artist.youtube && (
                  <a
                    href={artist.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
                  >
                    YouTube
                  </a>
                )}

                {artist.spotify && (
                  <a
                    href={artist.spotify}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
                  >
                    Spotify
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Songs Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Music ({artist.songs.length})
          </h2>

          {artist.songs.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500 text-lg">No songs available yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {artist.songs.map((song) => (
                <SongCard key={song.id} song={song} artist={artist} locale={locale} />
              ))}
            </div>
          )}
        </div>

        {/* Posts Section */}
        {artist.posts.length > 0 && (
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              Latest Posts
            </h2>

            <div className="space-y-6">
              {artist.posts.map((post) => (
                <div key={post.id} className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-gray-600 mb-4">
                      {post.excerpt}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>
                      {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Draft'}
                    </span>
                    <a
                      href={`/${locale}/posts/${post.slug}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Read More →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
