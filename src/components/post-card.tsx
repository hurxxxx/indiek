import Link from 'next/link';
import { Post, User, Artist, Tag } from '@prisma/client';

interface PostWithRelations extends Post {
  author: Pick<User, 'id' | 'name' | 'username'>;
  artist?: Pick<Artist, 'id' | 'name' | 'slug'> | null;
  tags: { tag: Tag }[];
  _count: {
    comments: number;
    likes: number;
  };
}

interface PostCardProps {
  post: PostWithRelations;
  locale: string;
}

export function PostCard({ post, locale }: PostCardProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return 'Draft';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <article className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
          <span>{formatDate(post.publishedAt)}</span>
          <div className="flex items-center space-x-4">
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
              </svg>
              {post._count.comments}
            </span>
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
              {post._count.likes}
            </span>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 mb-3 line-clamp-2">
          <Link 
            href={`/${locale}/posts/${post.slug}`}
            className="hover:text-blue-600 transition-colors"
          >
            {post.title}
          </Link>
        </h2>

        {post.excerpt && (
          <p className="text-gray-600 mb-4 line-clamp-3">
            {post.excerpt}
          </p>
        )}

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags.slice(0, 3).map(({ tag }) => (
              <span
                key={tag.id}
                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                style={{ backgroundColor: tag.color ? `${tag.color}20` : undefined }}
              >
                {tag.name}
              </span>
            ))}
            {post.tags.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                +{post.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Author and Artist */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center">
            <span className="text-gray-500">by</span>
            <span className="ml-1 font-medium text-gray-900">
              {post.author.name || post.author.username}
            </span>
          </div>

          {post.artist && (
            <Link
              href={`/${locale}/artists/${post.artist.slug}`}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              {post.artist.name}
            </Link>
          )}
        </div>

        {/* Read More */}
        <div className="mt-4">
          <Link
            href={`/${locale}/posts/${post.slug}`}
            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
          >
            Read More →
          </Link>
        </div>
      </div>
    </article>
  );
}
