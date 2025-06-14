import { Metadata } from 'next';

interface GenerateMetadataProps {
  title: string;
  description: string;
  locale: string;
  image?: string;
  type?: 'website' | 'article' | 'music.song' | 'profile';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  tags?: string[];
}

export function generateMetadata({
  title,
  description,
  locale,
  image = '/og-image.jpg',
  type = 'website',
  publishedTime,
  modifiedTime,
  author,
  tags
}: GenerateMetadataProps): Metadata {
  const siteName = 'Indiek - Korean Indie Artists Platform';
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  
  const metadata: Metadata = {
    title: `${title} | ${siteName}`,
    description,
    keywords: [
      'Korean indie music',
      'Korean artists',
      'indie music',
      'K-indie',
      'Korean musicians',
      'independent music',
      ...(tags || [])
    ],
    authors: author ? [{ name: author }] : [{ name: 'Indiek Team' }],
    creator: 'Indiek Platform',
    publisher: 'Indiek',
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        'en': '/en',
        'ko': '/ko',
        'es': '/es',
      },
    },
    openGraph: {
      title,
      description,
      type,
      locale,
      siteName,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
      creator: '@indiek_platform',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };

  return metadata;
}

export function generateStructuredData(data: any) {
  return {
    '@context': 'https://schema.org',
    ...data
  };
}

export function generateArtistStructuredData(artist: any) {
  return generateStructuredData({
    '@type': 'MusicGroup',
    name: artist.name,
    description: artist.bio,
    url: artist.website,
    image: artist.image,
    sameAs: [
      artist.instagram,
      artist.youtube,
      artist.spotify,
      artist.soundcloud
    ].filter(Boolean),
    genre: 'Indie',
    foundingLocation: {
      '@type': 'Country',
      name: 'South Korea'
    }
  });
}

export function generateSongStructuredData(song: any, artist: any) {
  return generateStructuredData({
    '@type': 'MusicRecording',
    name: song.title,
    description: song.description,
    duration: song.duration,
    datePublished: song.releaseDate,
    byArtist: {
      '@type': 'MusicGroup',
      name: artist.name
    },
    inAlbum: {
      '@type': 'MusicAlbum',
      name: 'Singles'
    },
    recordingOf: {
      '@type': 'MusicComposition',
      name: song.title,
      composer: {
        '@type': 'MusicGroup',
        name: artist.name
      }
    }
  });
}

export function generatePostStructuredData(post: any, author: any) {
  return generateStructuredData({
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    image: post.image,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: {
      '@type': 'Person',
      name: author.name || author.username
    },
    publisher: {
      '@type': 'Organization',
      name: 'Indiek',
      logo: {
        '@type': 'ImageObject',
        url: '/logo.png'
      }
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `/posts/${post.slug}`
    }
  });
}
