'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Comment, User } from '@prisma/client';
import { CommentForm } from './comment-form';

interface CommentWithAuthor extends Comment {
  author: Pick<User, 'id' | 'name' | 'username' | 'image'>;
  replies?: CommentWithAuthor[];
}

interface CommentItemProps {
  comment: CommentWithAuthor;
  postId: string;
  onReplyAdded: (parentId: string, reply: CommentWithAuthor) => void;
  isReply?: boolean;
}

export function CommentItem({ comment, postId, onReplyAdded, isReply = false }: CommentItemProps) {
  const { data: session } = useSession();
  const [showReplyForm, setShowReplyForm] = useState(false);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleReplyAdded = (newReply: CommentWithAuthor) => {
    onReplyAdded(comment.id, newReply);
    setShowReplyForm(false);
  };

  return (
    <div className={`${isReply ? 'ml-8 border-l-2 border-gray-200 pl-4' : ''}`}>
      <div className="flex space-x-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <span className="text-gray-600 text-sm font-medium">
              {(comment.author.name || comment.author.username)?.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Comment Content */}
        <div className="flex-1 min-w-0">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900">
                  {comment.author.name || comment.author.username}
                </span>
                <span className="text-sm text-gray-500">
                  {formatDate(comment.createdAt)}
                </span>
              </div>
            </div>
            
            <p className="text-gray-700 whitespace-pre-wrap">
              {comment.content}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-4 mt-2">
            {session && !isReply && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {showReplyForm ? 'Cancel' : 'Reply'}
              </button>
            )}
          </div>

          {/* Reply Form */}
          {showReplyForm && (
            <div className="mt-4">
              <CommentForm
                postId={postId}
                parentId={comment.id}
                onCommentAdded={handleReplyAdded}
                onCancel={() => setShowReplyForm(false)}
                placeholder="Write your reply..."
              />
            </div>
          )}

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-4 space-y-4">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  postId={postId}
                  onReplyAdded={onReplyAdded}
                  isReply={true}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
