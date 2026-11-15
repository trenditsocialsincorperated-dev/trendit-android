import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  Camera,
  CheckCircle2,
  Headphones,
  Info,
  KeyRound,
  Loader2,
  LogOut,
  Moon,
  Pencil,
  Sun,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { PWAInstallButton } from '@/components/ui/PWAInstallModal';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { sendPasswordReset } from '@/services/authService';
import {
  disableDevicePushNotifications,
  enableDevicePushNotifications,
  getPushDiagnostics,
} from '@/services/pushService';
import { openLiveSupportChat } from '@/services/supportService';
import { updateUserProfileData } from '@/services/userService';
import type { PushDiagnosticState, UserPreferences } from '@/types';

export const SettingsPage: React.FC = () => {
  const { firebaseUser, userProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaVerified, setMediaVerified] = useState<boolean | null>(null);
  const [pushDiag, setPushDiag] = useState<PushDiagnosticState | null>(null);
  const [savingPrefKey, setSavingPrefKey] = useState<string | null>(null);

  const prefs: Required<UserPreferences> = {
    notifyLikes: userProfile?.preferences?.notifyLikes ?? true,
    notifyReplies: userProfile?.preferences?.notifyReplies ?? true,
    notifyFollows: userProfile?.preferences?.notifyFollows ?? true,
    notifyMessages: userProfile?.preferences?.notifyMessages ?? true,
    privateProfile: userProfile?.preferences?.privateProfile ?? false,
  };

  const refreshDiagnostics = useCallback(async () => {
    const diag = await getPushDiagnostics(userProfile);
    setPushDiag(diag);
  }, [userProfile]);

  useEffect(() => {
    refreshDiagnostics();
  }, [refreshDiagnostics]);

  const handleTogglePreference = async (key: keyof UserPreferences) => {
    if (!userProfile || savingPrefKey) return;
    setSavingPrefKey(key);
    const nextPrefs: UserPreferences = {
      ...prefs,
      [key]: !prefs[key],
    };
    try {
      await updateUserProfileData(userProfile.uid, { preferences: nextPrefs });
    } catch {
      showToast('Could not save preference.', 'error');
    } finally {
      setSavingPrefKey(null);
    }
  };

  const handleSendPasswordReset = async () => {
    const email = firebaseUser?.email || userProfile?.email;
    if (!email) {
      showToast('No email address is linked to this sign-in method.', 'info');
      return;
    }
    setResetBusy(true);
    try {
      await sendPasswordReset(email);
      showToast(`Password reset link sent to ${email}.`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to send password reset email.', 'error');
    } finally {
      setResetBusy(false);
    }
  };

  const handleEnablePush = async () => {
    if (!userProfile || pushBusy) return;
    setPushBusy(true);
    try {
      const res = await enableDevicePushNotifications(userProfile.uid);
      showToast(res.message, res.success ? 'success' : 'info');
      await refreshDiagnostics();
    } finally {
      setPushBusy(false);
    }
  };

  const handleDisablePush = async () => {
    if (!userProfile || pushBusy) return;
    setPushBusy(true);
    try {
      await disableDevicePushNotifications(userProfile.uid);
      showToast('Device push token removed from your profile.', 'info');
      await refreshDiagnostics();
    } catch {
      showToast('Could not remove device push token.', 'error');
    } finally {
      setPushBusy(false);
    }
  };

  const handleVerifyMediaDevices = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('Camera and microphone APIs are not available in this browser.', 'error');
      setMediaVerified(false);
      return;
    }

    setMediaBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((track) => track.stop());
      setMediaVerified(true);
      showToast('Camera and microphone permissions are ready for Agora calling!', 'success');
    } catch {
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioOnly.getTracks().forEach((track) => track.stop());
        setMediaVerified(true);
        showToast('Microphone ready! Grant camera access when starting a video call.', 'info');
      } catch {
        setMediaVerified(false);
        showToast('Please allow microphone and camera permissions in your browser/device settings.', 'error');
      }
    } finally {
      setMediaBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    showToast('Signed out of Trendit.', 'info');
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Page Header */}
      <div className="rounded-3xl bg-white dark:bg-[#11141D] border border-slate-200/85 dark:border-slate-800/85 p-5 shadow-xs">
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Manage your Trendit account, appearance, notifications, and calling permissions
        </p>
      </div>

      {/* Account Card */}
      {userProfile && (
        <section className="rounded-3xl bg-white dark:bg-[#11141D] border border-slate-200/85 dark:border-slate-800/85 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3.5 min-w-0">
              <UserAvatar user={userProfile} size="lg" />
              <div className="min-w-0">
                <div className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {userProfile.displayName}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  @{userProfile.handle}
                  {firebaseUser?.email ? ` · ${firebaseUser.email}` : ''}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="min-h-[42px] px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#171C29] hover:border-violet-500 text-sm font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Pencil className="w-4 h-4 text-violet-500" />
              <span>Edit Profile</span>
            </button>
          </div>

          {firebaseUser?.email && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Password & Security
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Send a password reset email to {firebaseUser.email}
                </div>
              </div>

              <button
                type="button"
                disabled={resetBusy}
                onClick={handleSendPasswordReset}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                {resetBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <KeyRound className="w-3.5 h-3.5 text-violet-500" />
                )}
                <span>Reset Password</span>
              </button>
            </div>
          )}
        </section>
      )}

      {/* Appearance */}
      <section className="rounded-3xl bg-white dark:bg-[#11141D] border border-slate-200/85 dark:border-slate-800/85 p-5 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">Appearance</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Choose how Trendit looks across your feed, reels, and messages
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`min-h-[54px] px-4 py-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${
              theme === 'light'
                ? 'border-violet-600 bg-violet-600/8 text-violet-700 dark:text-violet-300'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Sun className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <div className="text-sm font-bold">Light Mode</div>
              <div className="text-[11px] opacity-75">Crisp daylight canvas</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`min-h-[54px] px-4 py-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${
              theme === 'dark'
                ? 'border-violet-500 bg-violet-500/12 text-violet-700 dark:text-violet-300'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Moon className="w-5 h-5 text-violet-400 shrink-0" />
            <div>
              <div className="text-sm font-bold">Dark Mode</div>
              <div className="text-[11px] opacity-75">Rich obsidian night theme</div>
            </div>
          </button>
        </div>
      </section>

      {/* Notifications & Audited Push Delivery */}
      <section className="rounded-3xl bg-white dark:bg-[#11141D] border border-slate-200/85 dark:border-slate-800/85 p-5 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-violet-500" />
              <span>Notifications & Push Delivery</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {pushDiag?.statusSummary ||
                'In-app notifications sync live via Firestore.'}
            </p>
          </div>

          {pushDiag?.hasStoredToken ? (
            <button
              type="button"
              disabled={pushBusy}
              onClick={handleDisablePush}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-rose-500 hover:text-rose-500 transition-colors whitespace-nowrap shrink-0"
            >
              {pushBusy ? 'Updating...' : 'Disconnect Device Push'}
            </button>
          ) : (
            <button
              type="button"
              disabled={pushBusy}
              onClick={handleEnablePush}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-95 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {pushBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Enable Device Push</span>
            </button>
          )}
        </div>

        {/* Honest Push Configuration Notice when external FCM keys are not provisioned */}
        {pushDiag && pushDiag.missingComponents.length > 0 && (
          <div className="rounded-2xl bg-slate-50 dark:bg-[#0C0F17] border border-slate-200/80 dark:border-slate-800 p-3.5 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-violet-500 shrink-0" />
              <span>Background Push Requirements</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400 leading-relaxed">
              {pushDiag.missingComponents.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Activity Preference Toggles */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/70 pt-1">
          {(
            [
              {
                key: 'notifyLikes',
                title: 'Likes on your posts',
                desc: 'Notify when someone likes a post you shared',
              },
              {
                key: 'notifyReplies',
                title: 'Replies & mentions',
                desc: 'Notify when someone replies to your thread',
              },
              {
                key: 'notifyFollows',
                title: 'New followers',
                desc: 'Notify when someone follows your profile',
              },
              {
                key: 'notifyMessages',
                title: 'Direct messages & calls',
                desc: 'Notify on incoming DMs and Agora voice/video calls',
              },
            ] as const
          ).map((item) => {
            const enabled = Boolean(prefs[item.key]);
            return (
              <div
                key={item.key}
                className="py-3 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {item.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {item.desc}
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  disabled={savingPrefKey === item.key}
                  onClick={() => handleTogglePreference(item.key)}
                  className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
                    enabled
                      ? 'bg-violet-600'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Audio & Video Calling Readiness */}
      <section className="rounded-3xl bg-white dark:bg-[#11141D] border border-slate-200/85 dark:border-slate-800/85 p-5 shadow-xs flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Camera className="w-4 h-4 text-electric-500" />
            <span>Voice & Video Calling</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Verify camera and microphone access for 1-to-1 Agora calls
          </p>
        </div>

        <button
          type="button"
          disabled={mediaBusy}
          onClick={handleVerifyMediaDevices}
          className="min-h-[42px] px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#171C29] hover:border-violet-500 text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
        >
          {mediaBusy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : mediaVerified ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : (
            <UserCheck className="w-4 h-4 text-violet-500" />
          )}
          <span>{mediaVerified ? 'Permissions Ready' : 'Check Camera & Mic'}</span>
        </button>
      </section>

      {/* App Install, Live Support & Sign Out */}
      <section className="rounded-3xl bg-white dark:bg-[#11141D] border border-slate-200/85 dark:border-slate-800/85 p-5 shadow-xs space-y-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2">
          App & Support
        </h2>

        <PWAInstallButton />

        <button
          type="button"
          onClick={() => {
            openLiveSupportChat();
            showToast('Opening Trendit Live Support chat...', 'info');
          }}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#141824] hover:bg-slate-100 dark:hover:bg-slate-800/80 text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2 transition-colors"
        >
          <Headphones className="w-4 h-4 text-fuchsia-500" />
          <span>Help & Live Support</span>
        </button>

        <button
          type="button"
          onClick={handleSignOut}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/8 hover:bg-rose-500/15 text-sm font-semibold text-rose-600 dark:text-rose-400 flex items-center justify-center gap-2 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </section>

      <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
};
