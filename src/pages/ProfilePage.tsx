import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Camera,
  ExternalLink,
  Loader2,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  UserCheck,
  UserPlus,
  Video,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useCall } from '@/contexts/CallContext';
import { useSocialData } from '@/contexts/SocialDataContext';
import { useToast } from '@/contexts/ToastContext';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { PostCard } from '@/components/feed/PostCard';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { FollowListModal } from '@/components/profile/FollowListModal';
import { uploadMediaAsset } from '@/services/mediaService';
import {
  getFollowCounts,
  toggleFollowUser,
  updateUserProfileData,
} from '@/services/userService';
import type { UserProfile } from '@/types';
import { formatCompactNumber, toDateSafe } from '@/utils/formatters';

type ProfileTab = 'posts' | 'media' | 'likes';

export const ProfilePage: React.FC = () => {
  const { uid: routeUid } = useParams<{ uid?: string }>();
  const navigate = useNavigate();
  const { userProfile: currentUser, isFollowingUser } = useAuth();
  const { posts, openLightbox } = useSocialData();
  const { startCall } = useCall();
  const { showToast } = useToast();

  const targetUid = routeUid || currentUser?.uid || '';
  const isOwnProfile = Boolean(currentUser?.uid && targetUid === currentUser.uid);

  const [viewedProfile, setViewedProfile] = useState<UserProfile | null>(
    isOwnProfile ? currentUser : null
  );
  const [profileLoading, setProfileLoading] = useState(!isOwnProfile);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [followModalKind, setFollowModalKind] = useState<'followers' | 'following' | null>(null);
  const [followPending, setFollowPending] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const quickAvatarRef = useRef<HTMLInputElement | null>(null);

  const refreshCounts = useCallback(async () => {
    if (!targetUid) return;
    const counts = await getFollowCounts(targetUid);
    setFollowersCount(counts.followersCount);
    setFollowingCount(counts.followingCount);
  }, [targetUid]);

  // Real-time profile subscription for the target user
  useEffect(() => {
    if (!targetUid) return;
    setProfileLoading(true);

    const unsub = onSnapshot(
      doc(db, 'users', targetUid),
      (snap) => {
        if (snap.exists()) {
          setViewedProfile({ uid: snap.id, ...(snap.data() as Omit<UserProfile, 'uid'>) });
        } else {
          setViewedProfile(null);
        }
        setProfileLoading(false);
      },
      () => {
        setProfileLoading(false);
      }
    );

    refreshCounts();
    return () => unsub();
  }, [targetUid, refreshCounts]);

  const userPosts = useMemo(
    () => posts.filter((p) => p.uid === targetUid),
    [posts, targetUid]
  );

  const mediaPosts = useMemo(
    () => userPosts.filter((p) => Boolean(p.mediaUrl)),
    [userPosts]
  );

  const likedPosts = useMemo(
    () => posts.filter((p) => p.likedBy.includes(targetUid)),
    [posts, targetUid]
  );

  const displayedPosts =
    activeTab === 'media' ? mediaPosts : activeTab === 'likes' ? likedPosts : userPosts;

  const followingTarget = Boolean(targetUid && !isOwnProfile && isFollowingUser(targetUid));

  const handleToggleFollow = async () => {
    if (!currentUser || !targetUid || isOwnProfile || followPending) return;
    setFollowPending(true);
    try {
      const res = await toggleFollowUser(currentUser, targetUid);
      await refreshCounts();
      showToast(
        res.isFollowing
          ? `Following @${viewedProfile?.handle || 'user'}`
          : `Unfollowed @${viewedProfile?.handle || 'user'}`,
        'info'
      );
    } catch {
      showToast('Failed to update follow status.', 'error');
    } finally {
      setFollowPending(false);
    }
  };

  const handleQuickAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !isOwnProfile) return;

    setAvatarUploading(true);
    try {
      const res = await uploadMediaAsset(file, 'avatars', currentUser.uid);
      await updateUserProfileData(currentUser.uid, { photoURL: res.url });
      showToast('Profile photo updated!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not upload profile photo.', 'error');
    } finally {
      setAvatarUploading(false);
      if (quickAvatarRef.current) quickAvatarRef.current.value = '';
    }
  };

  if (profileLoading) {
    return (
      <div className="py-20 flex items-center justify-center text-slate-400">
        <Loader2 className="w-7 h-7 animate-spin" />
      </div>
    );
  }

  if (!viewedProfile) {
    return (
      <div className="rounded-3xl bg-white dark:bg-[#11141D] border border-slate-200/85 dark:border-slate-800/85 p-10 text-center">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Profile not found</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          This Trendit user may have moved or does not exist.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-5 min-h-[42px] px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold"
        >
          Back to Feed
        </button>
      </div>
    );
  }

  const joinedDate = toDateSafe(viewedProfile.createdAt);
  const safeWebsiteUrl = viewedProfile.website
    ? viewedProfile.website.startsWith('http')
      ? viewedProfile.website
      : `https://${viewedProfile.website}`
    : null;

  return (
    <div className="space-y-4">
      {/* Profile Hero Card */}
      <div className="rounded-3xl bg-white dark:bg-[#11141D] border border-slate-200/85 dark:border-slate-800/85 shadow-xs overflow-hidden">
        {/* Cover Banner */}
        <div className="relative h-36 sm:h-48 bg-gradient-to-tr from-violet-600 via-electric-600 to-coral-500">
          {viewedProfile.coverURL && (
            <img
              src={viewedProfile.coverURL}
              alt={`${viewedProfile.displayName} cover`}
              referrerPolicy="no-referrer"
              onClick={() =>
                openLightbox(viewedProfile.coverURL!, 'image', `${viewedProfile.displayName} cover`)
              }
              className="w-full h-full object-cover cursor-zoom-in"
            />
          )}

          {routeUid && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="absolute top-3.5 left-3.5 min-h-[40px] min-w-[40px] rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Identity & Actions */}
        <div className="px-5 sm:px-6 pb-5">
          <div className="-mt-12 sm:-mt-14 flex flex-wrap items-end justify-between gap-3">
            <div className="relative inline-block">
              <UserAvatar
                user={viewedProfile}
                size="2xl"
                onClick={() => {
                  if (viewedProfile.photoURL) {
                    openLightbox(viewedProfile.photoURL, 'image', viewedProfile.displayName);
                  }
                }}
                className="ring-4 ring-white dark:ring-[#11141D] rounded-full"
              />

              {isOwnProfile && (
                <>
                  <input
                    ref={quickAvatarRef}
                    type="file"
                    accept="image/*"
                    onChange={handleQuickAvatarUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={avatarUploading}
                    onClick={() => quickAvatarRef.current?.click()}
                    aria-label="Update profile photo"
                    className="absolute bottom-0.5 right-0.5 w-9 h-9 rounded-full bg-violet-600 hover:bg-violet-500 text-white ring-2 ring-white dark:ring-[#11141D] flex items-center justify-center shadow transition-colors"
                  >
                    {avatarUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center flex-wrap gap-2 pt-2">
              {isOwnProfile ? (
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="min-h-[42px] px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#171C29] hover:border-violet-500 text-sm font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                >
                  <Pencil className="w-4 h-4 text-violet-500" />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => startCall(viewedProfile.uid, 'audio')}
                    aria-label="Start voice call"
                    title="Voice call"
                    className="min-h-[42px] min-w-[42px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#171C29] text-slate-700 dark:text-slate-200 hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 flex items-center justify-center transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => startCall(viewedProfile.uid, 'video')}
                    aria-label="Start video call"
                    title="Video call"
                    className="min-h-[42px] min-w-[42px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#171C29] text-slate-700 dark:text-slate-200 hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 flex items-center justify-center transition-colors"
                  >
                    <Video className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(`/messages/${viewedProfile.uid}`)}
                    aria-label="Send direct message"
                    className="min-h-[42px] px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#171C29] text-slate-800 dark:text-slate-200 hover:border-violet-500 text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Message</span>
                  </button>

                  <button
                    type="button"
                    disabled={followPending}
                    onClick={handleToggleFollow}
                    className={`min-h-[42px] px-5 py-2 rounded-2xl text-sm font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                      followingTarget
                        ? 'border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-rose-500 hover:text-rose-500'
                        : 'bg-gradient-to-r from-violet-600 via-fuchsia-600 to-coral-500 text-white shadow-sm hover:opacity-95'
                    }`}
                  >
                    {followPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : followingTarget ? (
                      <UserCheck className="w-4 h-4" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    <span>{followingTarget ? 'Following' : 'Follow'}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Name, Handle & Bio */}
          <div className="mt-4">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {viewedProfile.displayName}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              @{viewedProfile.handle}
            </p>

            {viewedProfile.bio && (
              <p className="mt-3 text-sm sm:text-[15px] text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {viewedProfile.bio}
              </p>
            )}

            {/* Unboxed Clean Metadata Row (Zero-Pill Discipline) */}
            <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              {viewedProfile.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{viewedProfile.location}</span>
                </span>
              )}

              {safeWebsiteUrl && (
                <a
                  href={safeWebsiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[200px]">
                    {viewedProfile.website?.replace(/^https?:\/\//, '')}
                  </span>
                </a>
              )}

              {joinedDate && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Joined{' '}
                    {joinedDate.toLocaleDateString(undefined, {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </span>
              )}

              {viewedProfile.gender && viewedProfile.gender !== 'Prefer not to say' && (
                <span>{viewedProfile.gender}</span>
              )}
            </div>

            {/* Stats Row */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-6">
              <div className="text-sm">
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatCompactNumber(userPosts.length)}
                </span>{' '}
                <span className="text-slate-500 dark:text-slate-400">Posts</span>
              </div>

              <button
                type="button"
                onClick={() => setFollowModalKind('following')}
                className="text-sm hover:underline text-left"
              >
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatCompactNumber(followingCount)}
                </span>{' '}
                <span className="text-slate-500 dark:text-slate-400">Following</span>
              </button>

              <button
                type="button"
                onClick={() => setFollowModalKind('followers')}
                className="text-sm hover:underline text-left"
              >
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatCompactNumber(followersCount)}
                </span>{' '}
                <span className="text-slate-500 dark:text-slate-400">Followers</span>
              </button>
            </div>
          </div>
        </div>

        {/* Profile Stream Tabs */}
        <div className="px-5 border-t border-slate-200/80 dark:border-slate-800/80 grid grid-cols-3">
          {(
            [
              { id: 'posts', label: 'Posts', count: userPosts.length },
              { id: 'media', label: 'Media', count: mediaPosts.length },
              { id: 'likes', label: 'Likes', count: likedPosts.length },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative min-h-[46px] text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                  active
                    ? 'text-violet-600 dark:text-violet-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-xs opacity-75 tabular-nums">{tab.count}</span>
                {active && (
                  <span className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-violet-600 to-coral-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {displayedPosts.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-[#11141D] border border-slate-200/85 dark:border-slate-800/85 px-6 py-14 text-center shadow-xs">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {activeTab === 'posts'
              ? isOwnProfile
                ? 'You have not published any posts yet.'
                : `@${viewedProfile.handle} has not published any posts yet.`
              : activeTab === 'media'
              ? 'No photo, video, or audio posts yet.'
              : 'No liked posts to show yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {/* Modals */}
      {isOwnProfile && (
        <EditProfileModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSaved={refreshCounts}
        />
      )}

      <FollowListModal
        uid={targetUid}
        kind={followModalKind}
        onClose={() => setFollowModalKind(null)}
        onUpdated={refreshCounts}
      />
    </div>
  );
};
