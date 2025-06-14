import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ArtistForm } from '@/components/admin/artist-form';

export default async function NewArtistPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    redirect(`/${locale}/auth/signin`);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Add New Artist</h1>
        <p className="text-gray-600 mt-2">
          Create a new artist profile for the platform.
        </p>
      </div>

      <ArtistForm locale={locale} />
    </div>
  );
}
