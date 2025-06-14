'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Comment, User } from '@prisma/client';
import { CommentForm } from './comment-form';
import { CommentItem } from './comment-item';

interface CommentWithAuthor extends Comment {
  author: Pick<User, 'id' | 'name' | 'username' | 'image'>;
  replies?: CommentWithAuthor[];
}

interface CommentSectionProps {
  postId: string;
  comments: CommentWithAuthor[];
  locale: string;
}

export function CommentSection({ postId, comments: initialComments, locale }: CommentSectionProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState(initialComments);
  const [showCommentForm, setShowCommentForm] = useState(false);

  const handleCommentAdded = (newComment: CommentWithAuthor) => {
    setComments(prev => [newComment, ...prev]);
    setShowCommentForm(false);
  };

  const handleReplyAdded = (parentId: string, newReply: CommentWithAuthor) => {
    setComments(prev => prev.map(comment => 
      comment.id === parentId 
        ? { ...comment, replies: [...(comment.replies || []), newReply] }
        : comment
    ));
  };

  return (
    <section className="border-t border-gray-200 pt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Comments ({comments.length})
        </h2>
        
        {session && (
          <button
            onClick={() => setShowCommentForm(!showCommentForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            {showCommentForm ? 'Cancel' : 'Add Comment'}
          </button>
        )}
      </div>

      {!session && (
        <div className="bg-gray-50 rounded-lg p-6 mb-6 text-center">
          <p className="text-gray-600 mb-4">
            Please sign in to leave a comment.
          </p>
          <a
            href={`/${locale}/auth/signin`}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Sign In
          </a>
        </div>
      )}

      {showCommentForm && session && (
        <div className="mb-8">
          <CommentForm
            postId={postId}
            onCommentAdded={handleCommentAdded}
            onCancel={() => setShowCommentForm(false)}
          />
        </div>
      )}

      {comments.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              onReplyAdded={handleReplyAdded}
            />
          ))}
        </div>
      )}
    </section>
  );
}
