import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Repeat2,
  Trash2,
  Check,
  Music,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocialData } from '@/contexts/SocialDataContext';
import { useToast } from '@/contexts/ToastContext';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { deleteOwnPost, toggleLikeOnPost, voteOnPostPoll } from '@/services/postService';
import type { Post } from '@/types';
import { formatCompactNumber, formatTimeAgo } from '@/utils/formatters';

interface PostCardProps {
  post: Post;
  isDetailView?: boolean;
}

export const PostCard: React.FC<PostCardProps> = ({ post, isDetailView = false }) => {
  const navigate = useNavigate();
  const { userProfile, isBookmarked, toggleBookmark } = useAuth();
  const { openLightbox, openComposerModal } = useSocialData();
  const { showToast } = useToast();

  const [likePending, setLikePending] = useState(false);
  const [votePending, setVotePending] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const currentUid = userProfile?.uid || '';
  const isLiked = Boolean(currentUid && post.likedBy.includes(currentUid));
  const saved = isBookmarked(post.id);
  const isOwner = Boolean(currentUid && post.uid === currentUid);

  const goToProfile = (e: React.MouseEvent, uid: string) => {
    e.stopPropagation();
    if (!uid) return;
    navigate(uid === currentUid ? '/profile' : `/profile/${uid}`);
  };

  const goToThread = () => {
    if (!isDetailView) {
      navigate(`/post/${post.id}`);
    }
  };

  const handleToggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userProfile || likePending) return;
    setLikePending(true);
    try {
      await toggleLikeOnPost(post.id, userProfile);
    } catch {
      showToast('Could not update like right now.', 'error');
    } finally {
      setLikePending(false);
    }
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleBookmark(post.id);
    showToast(saved ? 'Removed from Bookmarks' : 'Saved to Bookmarks', 'info');
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const postUrl = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${post.displayName} on Trendit`,
          text: post.text?.slice(0, 120) || 'Check out this post on Trendit',
          url: postUrl,
        });
        return;
      } catch {
        // User cancelled or share failed; fall back to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(postUrl);
      showToast('Post link copied to clipboard!', 'success');
    } catch {
      showToast('Link ready: ' + postUrl, 'info');
    }
  };

  const handleQuoteRepost = (e: React.MouseEvent) => {
    e.stopPropagation();
    openComposerModal({
      postId: post.id,
      uid: post.uid,
      displayName: post.displayName,
      handle: post.handle,
      text: post.text,
      mediaUrl: post.mediaUrl,
      mediaType: post.mediaType,
    });
  };

  const handleVote = async (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    if (!userProfile || votePending) return;
    setVotePending(true);
    try {
      await voteOnPostPoll(post.id, userProfile.uid, idx);
    } catch {
      showToast('Could not submit vote.', 'error');
    } finally {
      setVotePending(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUid) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      window.setTimeout(() => setConfirmDelete(false), 3500);
      return;
    }
    try {
      await deleteOwnPost(post.id, currentUid);
      showToast('Post deleted.', 'info');
      if (isDetailView) navigate('/');
    } catch (err: any) {
      showToast(err?.message || 'Could not delete post.', 'error');
    }
  };

  const renderRichText = (content: string) => {
    if (!content) return null;
    const tokens = content.split(/(#[a-zA-Z0-9_]{2,40}|@[a-zA-Z0-9_]{2,30})/g);
    return tokens.map((part, idx) => {
      if (part.startsWith('#')) {
        return (
          <button
            key={idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/explore?q=${encodeURIComponent(part)}`);
            }}
            className="text-violet-600 dark:text-violet-400 hover:underline font-medium"
          >
            {part}
          </button>
        );
      }
      if (part.startsWith('@')) {
        return (
          <button
            key={idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/explore?q=${encodeURIComponent(part.slice(1))}`);
            }}
            className="text-blue-600 dark:text-sky-400 hover:underline font-medium"
          >
            {part}
          </button>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  const userPollChoice =
    post.poll?.voters && currentUid ? post.poll.voters[currentUid] : undefined;
  const totalPollVotes = post.poll?.totalVotes || 0;

  return (
    <article
      onClick={goToThread}
      className={`bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 transition-colors ${
        !isDetailView
          ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-700'
          : ''
      }`}
    >
      <div className="flex gap-3.5">
        <UserAvatar
          src={post.userPhotoURL}
          name={post.displayName}
          user={{ uid: post.uid, handle: post.handle, displayName: post.displayName }}
          size="md"
          onClick={(e) => goToProfile(e, post.uid)}
        />

        <div className="flex-1 min-w-0">
          {/* Clean Unboxed Metadata Header (Zero-Pill Discipline) */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm min-w-0 flex-wrap">
              <button
                type="button"
                onClick={(e) => goToProfile(e, post.uid)}
                className="font-bold text-slate-900 dark:text-slate-100 hover:underline truncate max-w-[180px] sm:max-w-[240px]"
              >
                {post.displayName}
              </button>
              <span className="text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                @{post.handle}
              </span>
              <span aria-hidden="true" className="text-slate-400 dark:text-slate-600">
                ·
              </span>
              <time className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {formatTimeAgo(post.createdAt)}
              </time>
            </div>

            {isOwner && (
              <button
                type="button"
                onClick={handleDelete}
                title={confirmDelete ? 'Tap again to confirm delete' : 'Delete post'}
                className={`p-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition-colors ${
                  confirmDelete
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 px-2.5'
                    : 'text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                {confirmDelete && <span>Confirm</span>}
              </button>
            )}
          </div>

          {/* Post Body Text */}
          {post.text && (
            <div className="mt-1.5 text-[15px] leading-relaxed text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">
              {renderRichText(post.text)}
            </div>
          )}

          {/* Post Media */}
          {post.mediaUrl && !mediaFailed && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="mt-3 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-slate-100 dark:bg-black/40"
            >
              {(post.mediaType === 'image' || !post.mediaType) && (
                <img
                  src={post.mediaUrl}
                  alt={post.text?.slice(0, 60) || `Post by ${post.displayName}`}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  onError={() => setMediaFailed(true)}
                  onClick={() => openLightbox(post.mediaUrl!, 'image', post.text)}
                  className="w-full max-h-[430px] object-cover cursor-zoom-in"
                />
              )}

              {post.mediaType === 'video' && (
                <video
                  src={post.mediaUrl}
                  controls
                  playsInline
                  preload="metadata"
                  onError={() => setMediaFailed(true)}
                  className="w-full max-h-[430px] object-contain bg-black"
                />
              )}

              {post.mediaType === 'audio' && (
                <div className="p-4 flex items-center gap-3 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/5 to-transparent">
                  <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0">
                    <Music className="w-5 h-5" />
                  </div>
                  <audio
                    src={post.mediaUrl}
                    controls
                    onError={() => setMediaFailed(true)}
                    className="w-full h-10"
                  />
                </div>
              )}
            </div>
          )}

          {/* Quoted Post */}
          {post.repostOf && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/post/${post.repostOf!.postId}`);
              }}
              className="mt-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E15] hover:border-violet-500/40 transition-colors cursor-pointer"
            >
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {post.repostOf.displayName}
                </span>{' '}
                · @{post.repostOf.handle}
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3">
                {post.repostOf.text}
              </p>
            </div>
          )}

          {/* Interactive Poll */}
          {post.poll && Array.isArray(post.poll.options) && post.poll.options.length > 0 && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="mt-3 space-y-2"
            >
              {post.poll.options.map((option, idx) => {
                const votes = Number(option.votes) || 0;
                const pct =
                  totalPollVotes > 0 ? Math.round((votes / totalPollVotes) * 100) : 0;
                const isSelected = userPollChoice === idx;

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={userPollChoice !== undefined || votePending}
                    onClick={(e) => handleVote(e, idx)}
                    className={`relative w-full min-h-[42px] rounded-xl border text-left px-3.5 py-2 overflow-hidden transition-colors ${
                      isSelected
                        ? 'border-violet-500/70 bg-violet-500/5'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0D1018] hover:border-violet-500/50'
                    }`}
                  >
                    <div
                      className={`absolute inset-y-0 left-0 transition-all duration-200 ${
                        isSelected
                          ? 'bg-gradient-to-r from-violet-600/25 to-fuchsia-500/20'
                          : 'bg-slate-200/70 dark:bg-slate-800/70'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative z-10 flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">
                        <span>{option.text}</span>
                        {isSelected && <Check className="w-4 h-4 text-violet-500 shrink-0" />}
                      </span>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums shrink-0">
                        {pct}%
                      </span>
                    </div>
                  </button>
                );
              })}
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums pt-0.5">
                {totalPollVotes} {totalPollVotes === 1 ? 'vote' : 'votes'}
                {userPollChoice !== undefined ? ' · Voted' : ' · Tap an option to vote'}
              </p>
            </div>
          )}

          {/* Action Bar (44px touch targets on mobile) */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-3 pt-1 flex items-center justify-between max-w-md -ml-2"
          >
            <button
              type="button"
              onClick={() => navigate(`/post/${post.id}`)}
              aria-label="Reply to post"
              className="min-h-[40px] px-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-sky-400 hover:bg-blue-500/10 inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
            >
              <MessageCircle className="w-[18px] h-[18px]" />
              <span className="tabular-nums">{formatCompactNumber(post.repliesCount)}</span>
            </button>

            <button
              type="button"
              onClick={handleQuoteRepost}
              aria-label="Quote post"
              className="min-h-[40px] px-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
            >
              <Repeat2 className="w-[18px] h-[18px]" />
            </button>

            <button
              type="button"
              onClick={handleToggleLike}
              aria-label={isLiked ? 'Unlike post' : 'Like post'}
              className={`min-h-[40px] px-2.5 rounded-xl inline-flex items-center gap-1.5 text-xs font-medium transition-transform active:scale-95 ${
                isLiked
                  ? 'text-rose-500 bg-rose-500/10'
                  : 'text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:bg-rose-500/10'
              }`}
            >
              <Heart className={`w-[18px] h-[18px] ${isLiked ? 'fill-current' : ''}`} />
              <span className="tabular-nums">{formatCompactNumber(post.likesCount)}</span>
            </button>

            <button
              type="button"
              onClick={handleBookmark}
              aria-label={saved ? 'Remove bookmark' : 'Bookmark post'}
              className={`min-h-[40px] px-2.5 rounded-xl inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
                saved
                  ? 'text-violet-600 dark:text-violet-400 bg-violet-500/10'
                  : 'text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-500/10'
              }`}
            >
              <Bookmark className={`w-[18px] h-[18px] ${saved ? 'fill-current' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleShare}
              aria-label="Share post"
              className="min-h-[40px] px-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-500/10 inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
            >
              <Share2 className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
