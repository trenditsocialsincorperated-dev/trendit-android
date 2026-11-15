import React, { useRef, useState } from 'react';
import {
  ImagePlus,
  BarChart2,
  X,
  Plus,
  Loader2,
  Music,
  Film,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { detectMediaType, uploadMediaAsset } from '@/services/mediaService';
import { createNewPost } from '@/services/postService';
import type { MediaType, RepostPreview } from '@/types';

interface PostComposerProps {
  placeholder?: string;
  quotePost?: RepostPreview | null;
  onClearQuote?: () => void;
  onSuccess?: () => void;
  compact?: boolean;
}

export const PostComposer: React.FC<PostComposerProps> = ({
  placeholder = "What's trending right now?",
  quotePost = null,
  onClearQuote,
  onSuccess,
  compact = false,
}) => {
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<MediaType>('image');
  const [pollActive, setPollActive] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!userProfile) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 35 * 1024 * 1024) {
      showToast('Please select a media file smaller than 35 MB.', 'error');
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const type = detectMediaType(file);
    setSelectedFile(file);
    setPreviewType(type);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const clearMedia = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updatePollOption = (idx: number, val: string) => {
    setPollOptions((prev) => prev.map((opt, i) => (i === idx ? val : opt)));
  };

  const addPollOptionSlot = () => {
    if (pollOptions.length < 4) {
      setPollOptions((prev) => [...prev, '']);
    }
  };

  const removePollOptionSlot = (idx: number) => {
    if (pollOptions.length <= 2) return;
    setPollOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const validPollCount = pollOptions.filter((o) => o.trim().length > 0).length;
  const canSubmit =
    !submitting &&
    (text.trim().length > 0 ||
      Boolean(selectedFile) ||
      Boolean(quotePost) ||
      (pollActive && validPollCount >= 2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !userProfile) return;

    if (pollActive && validPollCount < 2) {
      showToast('Add at least 2 poll options or close the poll builder.', 'error');
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);

    try {
      let uploadedUrl: string | null = null;
      let uploadedType: MediaType | null = null;

      if (selectedFile) {
        const uploaded = await uploadMediaAsset(
          selectedFile,
          'posts',
          userProfile.uid,
          (pct) => setUploadProgress(pct)
        );
        uploadedUrl = uploaded.url;
        uploadedType = uploaded.mediaType;
      }

      await createNewPost({
        author: userProfile,
        text,
        mediaUrl: uploadedUrl,
        mediaType: uploadedType,
        pollOptions: pollActive ? pollOptions : [],
        repostOf: quotePost,
      });

      setText('');
      clearMedia();
      setPollActive(false);
      setPollOptions(['', '']);
      onClearQuote?.();
      showToast('Published to Trendit!', 'success');
      onSuccess?.();
    } catch (err: any) {
      showToast(err?.message || 'Failed to publish post.', 'error');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 transition-colors"
    >
      <div className="flex gap-3.5">
        <UserAvatar user={userProfile} size="md" />
        <div className="flex-1 min-w-0">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            rows={compact ? 3 : 2}
            maxLength={1000}
            className="w-full bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-[15px] sm:text-base leading-relaxed resize-none focus:outline-none min-h-[68px]"
          />

          {/* Media Preview */}
          {previewUrl && (
            <div className="relative mt-2 mb-3 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950/5 dark:bg-black/30">
              <button
                type="button"
                onClick={clearMedia}
                aria-label="Remove selected media"
                className="absolute top-2.5 right-2.5 z-10 min-h-[36px] min-w-[36px] rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {previewType === 'image' && (
                <img
                  src={previewUrl}
                  alt="Selected upload preview"
                  className="w-full max-h-72 object-cover"
                />
              )}
              {previewType === 'video' && (
                <video
                  src={previewUrl}
                  controls
                  playsInline
                  className="w-full max-h-72 object-contain bg-black"
                />
              )}
              {previewType === 'audio' && (
                <div className="p-4 pt-10 flex items-center gap-3">
                  <Music className="w-6 h-6 text-violet-500 shrink-0" />
                  <audio src={previewUrl} controls className="w-full" />
                </div>
              )}
            </div>
          )}

          {/* Poll Builder */}
          {pollActive && (
            <div className="mt-2 mb-3 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0E15] border border-slate-200/80 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Interactive Poll
                </span>
                <button
                  type="button"
                  onClick={() => setPollActive(false)}
                  className="text-xs font-medium text-rose-500 hover:underline"
                >
                  Remove poll
                </button>
              </div>

              {pollOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => updatePollOption(idx, e.target.value)}
                    placeholder={`Choice ${idx + 1}${idx >= 2 ? ' (optional)' : ''}`}
                    maxLength={80}
                    className="flex-1 h-10 px-3 rounded-xl bg-white dark:bg-[#141824] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removePollOptionSlot(idx)}
                      aria-label="Remove choice"
                      className="p-2 text-slate-400 hover:text-rose-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              {pollOptions.length < 4 && (
                <button
                  type="button"
                  onClick={addPollOptionSlot}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline pt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add choice</span>
                </button>
              )}
            </div>
          )}

          {/* Quote Post Preview */}
          {quotePost && (
            <div className="mt-2 mb-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E15] relative">
              {onClearQuote && (
                <button
                  type="button"
                  onClick={onClearQuote}
                  aria-label="Remove quoted post"
                  className="absolute top-2.5 right-2.5 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {quotePost.displayName}
                </span>{' '}
                · @{quotePost.handle}
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3">
                {quotePost.text}
              </p>
            </div>
          )}

          {/* Upload Progress */}
          {submitting && uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mb-3">
              <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                Uploading media · {uploadProgress}%
              </p>
            </div>
          )}

          {/* Footer Toolbar */}
          <div className="pt-3 mt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Upload photo, video, or audio"
                className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <ImagePlus className="w-4 h-4 text-violet-500" />
                <span>Media</span>
              </button>

              <button
                type="button"
                onClick={() => setPollActive((p) => !p)}
                title="Create a poll"
                className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  pollActive
                    ? 'bg-violet-500/15 text-violet-600 dark:text-violet-300'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400'
                }`}
              >
                <BarChart2 className="w-4 h-4 text-fuchsia-500" />
                <span>Poll</span>
              </button>

              {selectedFile && (
                <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-400 pl-2">
                  <Film className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[120px]">{selectedFile.name}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {text.length > 0 && (
                <span className="text-xs text-slate-400 tabular-nums">
                  {1000 - text.length}
                </span>
              )}
              <button
                type="submit"
                disabled={!canSubmit}
                className="min-h-[40px] px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-coral-500 text-white text-sm font-semibold shadow-sm hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-opacity whitespace-nowrap shrink-0"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{submitting ? 'Posting...' : 'Post'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
