import { prisma } from '@/lib/prisma';
import { PostCard } from '@/components/post-card';
import Link from 'next/link';

export default async function PostsPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  const { page = '1' } = await searchParams;
  
  const currentPage = parseInt(page);
  const limit = 12;
  const skip = (currentPage - 1) * limit;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: { isPublished: true },
      include: {
        author: {
          select: { id: true, name: true, username: true }
        },
        artist: {
          select: { id: true, name: true, slug: true }
        },
        tags: {
          include: { tag: true }
        },
        _count: {
          select: { comments: true, likes: true }
        }
      },
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.post.count({ where: { isPublished: true } })
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Blog Posts
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Discover stories, insights, and updates about Korean indie artists and music.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No posts found.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} locale={locale} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center space-x-2">
              {currentPage > 1 && (
                <Link
                  href={`/${locale}/posts?page=${currentPage - 1}`}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Previous
                </Link>
              )}
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <Link
                  key={pageNum}
                  href={`/${locale}/posts?page=${pageNum}`}
                  className={`px-4 py-2 border rounded-md ${
                    pageNum === currentPage
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </Link>
              ))}
              
              {currentPage < totalPages && (
                <Link
                  href={`/${locale}/posts?page=${currentPage + 1}`}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
