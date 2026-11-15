import React, { useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { uploadMediaAsset } from '@/services/mediaService';
import { updateUserProfileData } from '@/services/userService';

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  open,
  onClose,
  onSaved,
}) => {
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [handle, setHandle] = useState(userProfile?.handle || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [age, setAge] = useState(String(userProfile?.age || '18'));
  const [gender, setGender] = useState(userProfile?.gender || 'Prefer not to say');
  const [location, setLocation] = useState(userProfile?.location || '');
  const [website, setWebsite] = useState(userProfile?.website || '');

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  if (!open || !userProfile) return null;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !handle.trim()) {
      showToast('Display name and handle are required.', 'error');
      return;
    }

    setSaving(true);
    try {
      let nextPhotoURL = userProfile.photoURL || null;
      let nextCoverURL = userProfile.coverURL || null;

      if (avatarFile) {
        const res = await uploadMediaAsset(avatarFile, 'avatars', userProfile.uid);
        nextPhotoURL = res.url;
      }

      if (coverFile) {
        const res = await uploadMediaAsset(coverFile, 'covers', userProfile.uid);
        nextCoverURL = res.url;
      }

      await updateUserProfileData(userProfile.uid, {
        displayName: displayName.trim(),
        handle: handle.trim(),
        bio: bio.trim(),
        age: Number(age) || 18,
        gender,
        location: location.trim(),
        website: website.trim(),
        photoURL: nextPhotoURL,
        coverURL: nextCoverURL,
      });

      showToast('Profile updated!', 'success');
      onSaved?.();
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const displayedCover = coverPreview || userProfile.coverURL;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[85] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#121622] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl my-auto"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Profile</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="max-h-[76vh] overflow-y-auto">
          {/* Cover Banner */}
          <div className="relative h-32 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-coral-500">
            {displayedCover && (
              <img
                src={displayedCover}
                alt="Profile banner"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-black/65 hover:bg-black/80 text-white text-xs font-semibold inline-flex items-center gap-1.5 backdrop-blur-sm"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              <span>Change Banner</span>
            </button>
          </div>

          <div className="px-6 pb-6">
            {/* Avatar Picker */}
            <div className="-mt-10 mb-5 flex items-end justify-between">
              <div className="relative inline-block">
                <UserAvatar
                  src={avatarPreview || userProfile.photoURL}
                  user={userProfile}
                  size="xl"
                  className="ring-4 ring-white dark:ring-[#121622] rounded-full"
                />
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  aria-label="Upload new avatar"
                  className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-violet-600 hover:bg-violet-500 text-white ring-2 ring-white dark:ring-[#121622] flex items-center justify-center shadow"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={50}
                    required
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0E15] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Handle (@username)
                  </label>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    maxLength={28}
                    required
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0E15] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  maxLength={240}
                  placeholder="Tell the Trendit community about yourself..."
                  className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0E15] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white resize-none focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Age
                  </label>
                  <input
                    type="number"
                    min={13}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0E15] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0E15] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Lagos, London, NYC..."
                    maxLength={60}
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0E15] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Website
                  </label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://example.com"
                    maxLength={100}
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0E15] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[42px] px-6 py-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-coral-500 text-white text-sm font-semibold inline-flex items-center gap-2 hover:opacity-95 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{saving ? 'Saving...' : 'Save Profile'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
