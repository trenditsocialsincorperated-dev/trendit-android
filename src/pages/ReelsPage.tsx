import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  MessageCircle,
  Share2,
  Volume2,
  VolumeX,
  Clapperboard,
  Plus,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocialData } from '@/contexts/SocialDataContext';
import { useToast } from '@/contexts/ToastContext';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { toggleLikeOnPost } from '@/services/postService';
import { toggleFollowUser } from '@/services/userService';
import { formatCompactNumber, formatTimeAgo } from '@/utils/formatters';

export const ReelsPage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile, isFollowingUser } = useAuth();
  const { posts, openComposerModal } = useSocialData();
  const { showToast } = useToast();

  const [muted, setMuted] = useState(true);

  // Prioritize video posts first, followed by visual image posts from the real Firestore stream
  const reelPosts = useMemo(() => {
    const videos = posts.filter((p) => p.mediaUrl && p.mediaType === 'video');
    const images = posts.filter(
      (p) => p.mediaUrl && (!p.mediaType || p.mediaType === 'image')
    );
    return [...videos, ...images];
  }, [posts]);

  const handleShare = async (postId: string, authorName: string) => {
    const url = `${window.location.origin}/post/${postId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${authorName} on Trendit Reels`, url });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('Reel link copied!', 'success');
    } catch {}
  };

  if (reelPosts.length === 0) {
    return (
      <div className="bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-12 text-center max-w-lg mx-auto my-8 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-violet-500/15 text-violet-500 flex items-center justify-center mx-auto">
          <Clapperboard className="w-7 h-7" />
        </div>
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
          No Reels Published Yet
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Upload a video or visual post to launch the Trendit Reels stream.
        </p>
        <button
          type="button"
          onClick={() => openComposerModal(null)}
          className="min-h-[44px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-coral-500 text-white text-sm font-semibold inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Video or Photo</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[440px] mx-auto space-y-6 pb-8">
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Reels & Visuals
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Immersive videos and visual moments from the community
          </p>
        </div>
        <button
          type="button"
          onClick={() => openComposerModal(null)}
          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create</span>
        </button>
      </div>

      <div className="space-y-6">
        {reelPosts.map((reel) => {
          const liked = Boolean(userProfile?.uid && reel.likedBy.includes(userProfile.uid));
          const isSelf = reel.uid === userProfile?.uid;
          const following = isFollowingUser(reel.uid);

          return (
            <article
              key={reel.id}
              className="relative aspect-[9/15] max-h-[76vh] w-full rounded-3xl overflow-hidden bg-slate-950 border border-slate-200/50 dark:border-slate-800 shadow-xl flex flex-col justify-between"
            >
              {/* Media Background */}
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                {reel.mediaType === 'video' ? (
                  <video
                    src={reel.mediaUrl!}
                    loop
                    playsInline
                    autoPlay
                    muted={muted}
                    controls={false}
                    onClick={(e) => {
                      const vid = e.currentTarget;
                      if (vid.paused) vid.play().catch(() => {});
                      else vid.pause();
                    }}
                    className="w-full h-full object-cover cursor-pointer"
                  />
                ) : (
                  <img
                    src={reel.mediaUrl!}
                    alt={reel.text || `Visual by ${reel.displayName}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* Top Audio Mute Control */}
              <div className="relative z-10 p-4 flex justify-end bg-gradient-to-b from-black/60 to-transparent">
                {reel.mediaType === 'video' && (
                  <button
                    type="button"
                    onClick={() => setMuted((m) => !m)}
                    aria-label={muted ? 'Unmute video' : 'Mute video'}
                    className="min-h-[40px] min-w-[40px] rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md flex items-center justify-center"
                  >
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                )}
              </div>

              {/* Bottom Measured Scrim + Creator Info + Vertical Action Stack */}
              <div className="relative z-10 p-5 pt-16 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-end justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <UserAvatar
                      src={reel.userPhotoURL}
                      name={reel.displayName}
                      user={{ uid: reel.uid, handle: reel.handle }}
                      size="sm"
                      onClick={() =>
                        navigate(isSelf ? '/profile' : `/profile/${reel.uid}`)
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        navigate(isSelf ? '/profile' : `/profile/${reel.uid}`)
                      }
                      className="text-sm font-bold text-white hover:underline truncate"
                    >
                      @{reel.handle}
                    </button>
                    <span className="text-xs text-white/70">· {formatTimeAgo(reel.createdAt)}</span>

                    {!isSelf && userProfile && (
                      <button
                        type="button"
                        onClick={async () => {
                          await toggleFollowUser(userProfile, reel.uid);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-white/40 text-xs font-semibold text-white hover:bg-white/15 whitespace-nowrap shrink-0"
                      >
                        {following ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>

                  {reel.text && (
                    <p className="text-sm text-white/95 line-clamp-3 leading-snug">
                      {reel.text}
                    </p>
                  )}
                </div>

                {/* Right Vertical Action Rail */}
                <div className="flex flex-col items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => userProfile && toggleLikeOnPost(reel.id, userProfile)}
                    className="flex flex-col items-center gap-1 text-white"
                  >
                    <span
                      className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md transition-transform active:scale-90 ${
                        liked ? 'bg-rose-500 text-white' : 'bg-white/15 hover:bg-white/25'
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
                    </span>
                    <span className="text-xs font-semibold tabular-nums">
                      {formatCompactNumber(reel.likesCount)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(`/post/${reel.id}`)}
                    className="flex flex-col items-center gap-1 text-white"
                  >
                    <span className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md flex items-center justify-center">
                      <MessageCircle className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-semibold tabular-nums">
                      {formatCompactNumber(reel.repliesCount)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleShare(reel.id, reel.displayName)}
                    className="flex flex-col items-center gap-1 text-white"
                  >
                    <span className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md flex items-center justify-center">
                      <Share2 className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-semibold">Share</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
