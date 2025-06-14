import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { CommentSection } from '@/components/comment-section';
import Link from 'next/link';

interface PostPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function PostPage({ params }: PostPageProps) {
  const { locale, slug } = await params;
  
  const post = await prisma.post.findUnique({
    where: { slug },
    include: {
      author: {
        select: { id: true, name: true, username: true, image: true }
      },
      artist: {
        select: { id: true, name: true, slug: true }
      },
      tags: {
        include: { tag: true }
      },
      comments: {
        where: { isActive: true, parentId: null },
        include: {
          author: {
            select: { id: true, name: true, username: true, image: true }
          },
          replies: {
            where: { isActive: true },
            include: {
              author: {
                select: { id: true, name: true, username: true, image: true }
              }
            },
            orderBy: { createdAt: 'asc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      },
      _count: {
        select: { likes: true }
      }
    }
  });

  if (!post || !post.isPublished) {
    notFound();
  }

  const formatDate = (date: Date | null) => {
    if (!date) return 'Draft';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <header className="mb-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {post.title}
          </h1>
          
          {post.excerpt && (
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {post.excerpt}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-6">
          <div className="flex items-center mb-4 sm:mb-0">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-medium">
                  {(post.author.name || post.author.username)?.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">
                {post.author.name || post.author.username}
              </p>
              <p className="text-sm text-gray-500">
                {formatDate(post.publishedAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
              {post._count.likes} likes
            </span>
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
              </svg>
              {post.comments.length} comments
            </span>
          </div>
        </div>

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-6">
            {post.tags.map(({ tag }) => (
              <span
                key={tag.id}
                className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                style={{ backgroundColor: tag.color ? `${tag.color}20` : undefined }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Related Artist */}
        {post.artist && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-600 mb-1">Related Artist</p>
            <Link
              href={`/${locale}/artists/${post.artist.slug}`}
              className="text-lg font-medium text-blue-800 hover:text-blue-900"
            >
              {post.artist.name} →
            </Link>
          </div>
        )}
      </header>

      {/* Content */}
      <div 
        className="prose prose-lg max-w-none mb-12"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      {/* Comments Section */}
      <CommentSection 
        postId={post.id}
        comments={post.comments}
        locale={locale}
      />
    </article>
  );
}
