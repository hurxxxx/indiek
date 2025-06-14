import { PostForm } from '@/components/admin/post-form';
import { prisma } from '@/lib/prisma';

export default async function NewPostPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  
  // Get artists for the dropdown
  const artists = await prisma.artist.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' }
  });

  // Get tags for the dropdown
  const tags = await prisma.tag.findMany({
    orderBy: { name: 'asc' }
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create New Post</h1>
        <p className="text-gray-600 mt-2">
          Write a new blog post about an artist or music topic.
        </p>
      </div>

      <PostForm 
        locale={locale}
        artists={artists}
        tags={tags}
      />
    </div>
  );
}
