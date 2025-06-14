'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArtistCard } from './artist-card';
import { SongCard } from './song-card';
import { PostCard } from './post-card';

interface SearchResultsProps {
  locale: string;
  query: string;
  artists: any[];
  songs: any[];
  posts: any[];
  currentType: string;
  currentSort: string;
}

export function SearchResults({ 
  locale, 
  query, 
  artists, 
  songs, 
  posts, 
  currentType, 
  currentSort 
}: SearchResultsProps) {
  const t = useTranslations('search');
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleFilterChange = (type: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('type', type);
    router.push(`/${locale}/search?${params.toString()}`);
  };

  const handleSortChange = (sort: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('sort', sort);
    router.push(`/${locale}/search?${params.toString()}`);
  };

  const totalResults = artists.length + songs.length + posts.length;

  if (totalResults === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">{t('noResults')}</h3>
        <p className="mt-1 text-sm text-gray-500">
          Try adjusting your search terms or browse our content.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Filters and Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 space-y-4 sm:space-y-0">
        {/* Type Filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              currentType === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All ({totalResults})
          </button>
          {artists.length > 0 && (
            <button
              onClick={() => handleFilterChange('artists')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                currentType === 'artists'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Artists ({artists.length})
            </button>
          )}
          {songs.length > 0 && (
            <button
              onClick={() => handleFilterChange('songs')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                currentType === 'songs'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Songs ({songs.length})
            </button>
          )}
          {posts.length > 0 && (
            <button
              onClick={() => handleFilterChange('posts')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                currentType === 'posts'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Posts ({posts.length})
            </button>
          )}
        </div>

        {/* Sort Options */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">{t('sortBy')}:</span>
          <select
            value={currentSort}
            onChange={(e) => handleSortChange(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="newest">{t('newest')}</option>
            <option value="oldest">{t('oldest')}</option>
            <option value="popular">{t('popular')}</option>
            <option value="alphabetical">{t('alphabetical')}</option>
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-12">
        {/* Artists */}
        {(currentType === 'all' || currentType === 'artists') && artists.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Artists</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {artists.map((artist) => (
                <ArtistCard key={artist.id} artist={artist} locale={locale} />
              ))}
            </div>
          </section>
        )}

        {/* Songs */}
        {(currentType === 'all' || currentType === 'songs') && songs.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Songs</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {songs.map((song) => (
                <SongCard key={song.id} song={song} artist={song.artist} locale={locale} />
              ))}
            </div>
          </section>
        )}

        {/* Posts */}
        {(currentType === 'all' || currentType === 'posts') && posts.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Blog Posts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} locale={locale} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
