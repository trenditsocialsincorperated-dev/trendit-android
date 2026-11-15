import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, ChevronLeft, ChevronRight, ImagePlus, Type, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocialData } from '@/contexts/SocialDataContext';
import { useToast } from '@/contexts/ToastContext';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { detectMediaType, uploadMediaAsset } from '@/services/mediaService';
import { markStoryAsViewed, publishStory } from '@/services/storyService';
import { createNewPost } from '@/services/postService';
import type { Story } from '@/types';
import { formatTimeAgo } from '@/utils/formatters';

const STORY_GRADIENTS = [
  'from-violet-600 via-fuchsia-500 to-coral-500',
  'from-blue-600 via-indigo-600 to-violet-600',
  'from-rose-500 via-pink-600 to-purple-700',
  'from-emerald-500 via-teal-600 to-cyan-700',
];

export const StoriesBar: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { stories } = useSocialData();
  const { showToast } = useToast();

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);

  // Story Creator State
  const [mode, setMode] = useState<'media' | 'text'>('media');
  const [caption, setCaption] = useState('');
  const [gradientIdx, setGradientIdx] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (viewerIndex === null) return;
    const activeStory = stories[viewerIndex];
    if (!activeStory) {
      setViewerIndex(null);
      return;
    }
    if (userProfile?.uid) {
      markStoryAsViewed(activeStory.id, userProfile.uid);
    }

    const duration = activeStory.mediaType === 'video' ? 12000 : 6000;
    const timer = window.setTimeout(() => {
      if (viewerIndex < stories.length - 1) {
        setViewerIndex(viewerIndex + 1);
      } else {
        setViewerIndex(null);
      }
    }, duration);

    return () => window.clearTimeout(timer);
  }, [viewerIndex, stories, userProfile?.uid]);

  if (!userProfile) return null;

  const handleSelectStoryFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setMode('media');
  };

  const resetCreator = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setCaption('');
    setCreatorOpen(false);
  };

  const handleCreateStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || submitting) return;

    if (mode === 'media' && !file) {
      showToast('Select a photo or video, or switch to a Text Story.', 'error');
      return;
    }
    if (mode === 'text' && !caption.trim()) {
      showToast('Write something for your story.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      let mediaUrl: string | null = null;
      let mediaType: 'image' | 'video' | 'text' = 'text';

      if (mode === 'media' && file) {
        const uploaded = await uploadMediaAsset(file, 'stories', userProfile.uid);
        mediaUrl = uploaded.url;
        mediaType = detectMediaType(file) === 'video' ? 'video' : 'image';
      }

      try {
        await publishStory({
          author: userProfile,
          mediaUrl,
          mediaType,
          caption,
          bgGradient: STORY_GRADIENTS[gradientIdx],
        });
      } catch {
        // Fallback: if Firestore rules on live project only permit `posts`, publish media highlight to posts
        if (mediaUrl) {
          await createNewPost({
            author: userProfile,
            text: caption || 'Shared a moment ✨',
            mediaUrl,
            mediaType: mediaType === 'video' ? 'video' : 'image',
          });
        } else {
          throw new Error('Stories collection requires Firestore write rule permission.');
        }
      }

      showToast('Story shared!', 'success');
      resetCreator();
    } catch (err: any) {
      showToast(err?.message || 'Could not publish story.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const activeStory: Story | null = viewerIndex !== null ? stories[viewerIndex] || null : null;

  return (
    <>
      <div className="bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4">
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
          {/* Add Story Trigger */}
          <button
            type="button"
            onClick={() => setCreatorOpen(true)}
            className="flex flex-col items-center gap-1.5 shrink-0 group min-w-[64px]"
          >
            <div className="relative">
              <UserAvatar user={userProfile} size="lg" />
              <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-gradient-to-tr from-violet-600 to-coral-500 text-white ring-2 ring-white dark:ring-[#11141D] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              </span>
            </div>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[68px]">
              Your story
            </span>
          </button>

          {/* Active Stories */}
          {stories.map((story, idx) => {
            const viewed = Boolean(story.viewers?.includes(userProfile.uid));
            return (
              <button
                key={story.id}
                type="button"
                onClick={() => setViewerIndex(idx)}
                className="flex flex-col items-center gap-1.5 shrink-0 min-w-[64px] group"
              >
                <UserAvatar
                  src={story.userPhotoURL}
                  name={story.displayName}
                  user={{ uid: story.uid, handle: story.handle, displayName: story.displayName }}
                  size="lg"
                  hasStoryRing
                  storyViewed={viewed}
                  className="group-hover:scale-105 transition-transform"
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[70px]">
                  {story.displayName.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fullscreen Story Viewer */}
      {activeStory && viewerIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[85] bg-black/95 flex items-center justify-center p-0 sm:p-6"
        >
          <div className="relative w-full h-full sm:max-w-[420px] sm:max-h-[86vh] sm:rounded-3xl overflow-hidden bg-slate-950 flex flex-col justify-between shadow-2xl">
            {/* Progress Bars */}
            <div className="absolute top-0 inset-x-0 z-20 p-3 pt-safe bg-gradient-to-b from-black/80 via-black/40 to-transparent">
              <div className="flex gap-1 mb-3">
                {stories.map((s, i) => (
                  <div key={s.id} className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
                    <div
                      className={`h-full bg-white transition-all duration-300 ${
                        i <= viewerIndex ? 'w-full' : 'w-0'
                      }`}
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const targetUid = activeStory.uid;
                    setViewerIndex(null);
                    navigate(targetUid === userProfile.uid ? '/profile' : `/profile/${targetUid}`);
                  }}
                  className="flex items-center gap-2.5 text-left"
                >
                  <UserAvatar
                    src={activeStory.userPhotoURL}
                    name={activeStory.displayName}
                    user={{ uid: activeStory.uid, handle: activeStory.handle }}
                    size="sm"
                  />
                  <div>
                    <div className="text-sm font-bold text-white leading-tight">
                      {activeStory.displayName}
                    </div>
                    <div className="text-xs text-white/75">
                      @{activeStory.handle} · {formatTimeAgo(activeStory.createdAt)}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setViewerIndex(null)}
                  aria-label="Close story"
                  className="min-h-[40px] min-w-[40px] rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Story Stage */}
            <div className="relative flex-1 flex items-center justify-center overflow-hidden">
              {activeStory.mediaType === 'text' || !activeStory.mediaUrl ? (
                <div
                  className={`w-full h-full bg-gradient-to-br ${
                    activeStory.bgGradient || STORY_GRADIENTS[0]
                  } flex items-center justify-center p-8 text-center`}
                >
                  <p className="font-display text-2xl sm:text-3xl font-bold text-white leading-snug break-words">
                    {activeStory.caption}
                  </p>
                </div>
              ) : activeStory.mediaType === 'video' ? (
                <video
                  src={activeStory.mediaUrl}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain bg-black"
                />
              ) : (
                <img
                  src={activeStory.mediaUrl}
                  alt={activeStory.caption || 'Story'}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain bg-black"
                />
              )}

              {/* Prev / Next Navigation Zones */}
              {viewerIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setViewerIndex(viewerIndex - 1)}
                  aria-label="Previous story"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-20 min-h-[44px] min-w-[44px] rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}
              {viewerIndex < stories.length - 1 && (
                <button
                  type="button"
                  onClick={() => setViewerIndex(viewerIndex + 1)}
                  aria-label="Next story"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-20 min-h-[44px] min-w-[44px] rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* Caption Scrim */}
            {activeStory.caption && activeStory.mediaUrl && (
              <div className="relative z-20 p-5 pb-safe bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                <p className="text-sm text-white text-center leading-relaxed line-clamp-3">
                  {activeStory.caption}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Story Modal */}
      {creatorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={resetCreator}
          className="fixed inset-0 z-[85] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateStory}
            className="w-full max-w-md rounded-3xl bg-white dark:bg-[#121622] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Share a Story
              </h3>
              <button
                type="button"
                onClick={resetCreator}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#0B0E15]">
              <button
                type="button"
                onClick={() => setMode('media')}
                className={`flex-1 min-h-[38px] rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                  mode === 'media'
                    ? 'bg-white dark:bg-[#1A2030] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <ImagePlus className="w-4 h-4" />
                <span>Photo / Video</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('text')}
                className={`flex-1 min-h-[38px] rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                  mode === 'text'
                    ? 'bg-white dark:bg-[#1A2030] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Type className="w-4 h-4" />
                <span>Gradient Canvas</span>
              </button>
            </div>

            {mode === 'media' ? (
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleSelectStoryFile}
                  className="hidden"
                />
                {previewUrl ? (
                  <div className="relative rounded-2xl overflow-hidden h-56 bg-black">
                    {file?.type.startsWith('video/') ? (
                      <video src={previewUrl} controls className="w-full h-full object-contain" />
                    ) : (
                      <img src={previewUrl} alt="Story preview" className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-black/70 text-white text-xs font-semibold"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full h-48 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-violet-500 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400 transition-colors"
                  >
                    <ImagePlus className="w-8 h-8 text-violet-500" />
                    <span className="text-sm font-medium">Tap to choose photo or video</span>
                  </button>
                )}

                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add an optional caption..."
                  maxLength={160}
                  className="mt-3 w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0E15] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  className={`rounded-2xl p-6 min-h-[200px] bg-gradient-to-br ${STORY_GRADIENTS[gradientIdx]} flex items-center justify-center`}
                >
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Type your story highlight..."
                    maxLength={200}
                    rows={3}
                    className="w-full bg-transparent text-center font-display text-xl font-bold text-white placeholder:text-white/60 resize-none focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-center gap-2.5">
                  {STORY_GRADIENTS.map((grad, idx) => (
                    <button
                      key={grad}
                      type="button"
                      onClick={() => setGradientIdx(idx)}
                      aria-label={`Select gradient ${idx + 1}`}
                      className={`w-8 h-8 rounded-full bg-gradient-to-tr ${grad} ${
                        gradientIdx === idx ? 'ring-2 ring-offset-2 ring-violet-500 dark:ring-offset-[#121622]' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-coral-500 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{submitting ? 'Sharing...' : 'Share Story'}</span>
            </button>
          </form>
        </div>
      )}
    </>
  );
};
