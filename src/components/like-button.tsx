'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface LikeButtonProps {
  postId?: string;
  songId?: string;
  initialLikeCount: number;
  initialIsLiked?: boolean;
}

export function LikeButton({ postId, songId, initialLikeCount, initialIsLiked = false }: LikeButtonProps) {
  const { data: session } = useSession();
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [isLoading, setIsLoading] = useState(false);

  const handleLike = async () => {
    if (!session) {
      // Redirect to login or show login modal
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/likes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId: postId || null,
          songId: songId || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setIsLiked(data.liked);
        setLikeCount(prev => data.liked ? prev + 1 : prev - 1);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLike}
      disabled={isLoading || !session}
      className={`flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
        isLiked
          ? 'bg-red-100 text-red-700 hover:bg-red-200'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      } ${!session ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={!session ? 'Sign in to like' : isLiked ? 'Unlike' : 'Like'}
    >
      <svg 
        className={`w-4 h-4 ${isLiked ? 'fill-current' : 'stroke-current fill-none'}`} 
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" 
        />
      </svg>
      <span>{likeCount}</span>
    </button>
  );
}
