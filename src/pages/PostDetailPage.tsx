import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { PostCard } from '@/components/feed/PostCard';
import { UserAvatar } from '@/components/ui/UserAvatar';
import {
  addPostReply,
  subscribeToPostReplies,
  subscribeToSinglePost,
} from '@/services/postService';
import type { Post, Reply } from '@/types';
import { formatTimeAgo } from '@/utils/formatters';

export const PostDetailPage: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!postId) return;
    setLoading(true);

    const unsubPost = subscribeToSinglePost(postId, (data) => {
      setPost(data);
      setLoading(false);
    });

    const unsubReplies = subscribeToPostReplies(postId, (items) => {
      setReplies(items);
    });

    return () => {
      unsubPost();
      unsubReplies();
    };
  }, [postId]);

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postId || !post || !userProfile || !replyText.trim() || submitting) return;

    setSubmitting(true);
    try {
      await addPostReply(postId, post.uid, userProfile, replyText);
      setReplyText('');
      showToast('Reply posted!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not post reply.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="min-h-[42px] min-w-[42px] rounded-xl bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:border-violet-500/40 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white">
          Post Conversation
        </h1>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-violet-500" />
        </div>
      ) : !post ? (
        <div className="bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-10 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This post was deleted or could not be found.
          </p>
        </div>
      ) : (
        <>
          <PostCard post={post} isDetailView />

          {/* Reply Composer */}
          {userProfile && (
            <form
              onSubmit={handleReplySubmit}
              className="bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 flex items-start gap-3"
            >
              <UserAvatar user={userProfile} size="sm" />
              <div className="flex-1 min-w-0 flex items-end gap-2.5">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to @${post.handle}...`}
                  rows={2}
                  maxLength={600}
                  className="flex-1 bg-slate-50 dark:bg-[#0B0E15] border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white resize-none focus:outline-none focus:border-violet-500"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || submitting}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-semibold inline-flex items-center gap-1.5 hover:opacity-95 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Reply</span>
                </button>
              </div>
            </form>
          )}

          {/* Replies Thread */}
          <div className="space-y-3">
            <h2 className="px-1 text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
              {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
            </h2>

            {replies.length === 0 ? (
              <div className="bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No replies yet. Add your voice to the conversation above.
              </div>
            ) : (
              replies.map((reply) => (
                <div
                  key={reply.id}
                  className="bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 flex gap-3"
                >
                  <UserAvatar
                    src={reply.userPhotoURL}
                    name={reply.displayName}
                    user={{ uid: reply.uid, handle: reply.handle }}
                    size="sm"
                    onClick={() =>
                      navigate(
                        reply.uid === userProfile?.uid ? '/profile' : `/profile/${reply.uid}`
                      )
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-sm flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            reply.uid === userProfile?.uid
                              ? '/profile'
                              : `/profile/${reply.uid}`
                          )
                        }
                        className="font-bold text-slate-900 dark:text-slate-100 hover:underline"
                      >
                        {reply.displayName}
                      </button>
                      <span className="text-slate-500 dark:text-slate-400">@{reply.handle}</span>
                      <span aria-hidden="true" className="text-slate-400 dark:text-slate-600">
                        ·
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {formatTimeAgo(reply.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                      {reply.text}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};
