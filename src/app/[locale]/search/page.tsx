import { prisma } from '@/lib/prisma';
import { SearchResults } from '@/components/search-results';
import { SearchBar } from '@/components/search-bar';

interface SearchPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; type?: string; sort?: string }>;
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { locale } = await params;
  const { q: query, type = 'all', sort = 'newest' } = await searchParams;

  if (!query) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Search</h1>
          <div className="max-w-2xl mx-auto">
            <SearchBar locale={locale} className="mb-8" />
            <p className="text-gray-600">
              Search for artists, songs, or blog posts to discover Korean indie music.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Search logic
  const searchTerm = `%${query}%`;
  
  const [artists, songs, posts] = await Promise.all([
    type === 'all' || type === 'artists' ? prisma.artist.findMany({
      where: {
        AND: [
          { isActive: true },
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { bio: { contains: query, mode: 'insensitive' } }
            ]
          }
        ]
      },
      include: {
        _count: { select: { songs: true } }
      },
      orderBy: sort === 'alphabetical' ? { name: 'asc' } : { createdAt: 'desc' },
      take: 20
    }) : [],
    
    type === 'all' || type === 'songs' ? prisma.song.findMany({
      where: {
        AND: [
          { isActive: true },
          {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { artist: { name: { contains: query, mode: 'insensitive' } } }
            ]
          }
        ]
      },
      include: {
        artist: { select: { id: true, name: true, slug: true } },
        _count: { select: { likes: true } }
      },
      orderBy: sort === 'alphabetical' ? { title: 'asc' } : 
               sort === 'popular' ? { likes: { _count: 'desc' } } : 
               { createdAt: 'desc' },
      take: 20
    }) : [],
    
    type === 'all' || type === 'posts' ? prisma.post.findMany({
      where: {
        AND: [
          { isPublished: true },
          {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { content: { contains: query, mode: 'insensitive' } },
              { excerpt: { contains: query, mode: 'insensitive' } }
            ]
          }
        ]
      },
      include: {
        author: { select: { id: true, name: true, username: true } },
        artist: { select: { id: true, name: true, slug: true } },
        tags: { include: { tag: true } },
        _count: { select: { comments: true, likes: true } }
      },
      orderBy: sort === 'alphabetical' ? { title: 'asc' } : 
               sort === 'popular' ? { likes: { _count: 'desc' } } : 
               { publishedAt: 'desc' },
      take: 20
    }) : []
  ]);

  const totalResults = artists.length + songs.length + posts.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Search Results</h1>
        <div className="max-w-2xl">
          <SearchBar locale={locale} className="mb-4" />
        </div>
        <p className="text-gray-600">
          {totalResults} results for "{query}"
        </p>
      </div>

      <SearchResults
        locale={locale}
        query={query}
        artists={artists}
        songs={songs}
        posts={posts}
        currentType={type}
        currentSort={sort}
      />
    </div>
  );
}
