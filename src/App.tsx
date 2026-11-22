import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SocialDataProvider } from '@/contexts/SocialDataContext';
import { CallProvider } from '@/contexts/CallContext';
import { AppShell } from '@/layouts/AppShell';
import { AuthPage } from '@/pages/AuthPage';
import { FeedPage } from '@/pages/FeedPage';
import { ExplorePage } from '@/pages/ExplorePage';
import { ReelsPage } from '@/pages/ReelsPage';
import { PostDetailPage } from '@/pages/PostDetailPage';
import { MessagesPage } from '@/pages/MessagesPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { BookmarksPage } from '@/pages/BookmarksPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SettingsPage } from '@/pages/SettingsPage';

interface PushTapPayload {
  type?: string;
  recipientUid?: string;
  senderUid?: string;
  senderName?: string;
  postId?: string;
  title?: string;
  body?: string;
}

const ScrollToTopOnRouteChange: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  return null;
};

/**
 * Receives notification taps from the Android NativePush bridge.
 *
 * The native plugin retains launch intents until this listener is ready, so
 * this also handles taps that start Trendit from a fully closed state.
 */
const AppRoutes: React.FC = () => {
  const { firebaseUser, loading } = useAuth();
  const navigate = useNavigate();
  const [pendingPushAction, setPendingPushAction] = useState<PushTapPayload | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const nativePush = (window as any).Capacitor?.Plugins?.NativePush;
    if (!nativePush?.addListener) return;

    let active = true;
    let listenerHandle: { remove: () => Promise<void> } | undefined;

    nativePush
      .addListener('notificationAction', (payload: PushTapPayload) => {
        if (!active || !payload || typeof payload !== 'object') return;
        setPendingPushAction(payload);
      })
      .then((handle: { remove: () => Promise<void> }) => {
        if (!active) {
          void handle.remove();
          return;
        }
        listenerHandle = handle;
      })
      .catch((error: unknown) => {
        console.warn('Could not attach Android notification-tap listener:', error);
      });

    return () => {
      active = false;
      if (listenerHandle) void listenerHandle.remove();
    };
  }, []);

  // Wait for Firebase authentication before navigating. This preserves a
  // notification tap received while the app is starting or showing login.
  useEffect(() => {
    if (loading || !firebaseUser || !pendingPushAction) return;

    const type = String(pendingPushAction.type || '').toLowerCase();
    const postId = String(pendingPushAction.postId || '').trim();
    const senderUid = String(pendingPushAction.senderUid || '').trim();

    let destination: string | null = null;

    // Match the in-app notification navigation priority.
    if (postId) {
      destination = `/post/${encodeURIComponent(postId)}`;
    } else if (type === 'dm' || type === 'call') {
      if (senderUid) destination = `/messages/${encodeURIComponent(senderUid)}`;
    } else if (senderUid) {
      // Follow and unfollow notifications, plus other actor-only events.
      destination = `/profile/${encodeURIComponent(senderUid)}`;
    }

    setPendingPushAction(null);
    if (destination) navigate(destination);
  }, [firebaseUser, loading, navigate, pendingPushAction]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090B10] flex flex-col items-center justify-center p-6">
        <div className="relative flex items-center justify-center mb-4">
          <img
            src="/icon-192.png"
            alt="Trendit"
            className="w-16 h-16 rounded-3xl shadow-lg object-cover"
          />
        </div>
        <div className="font-display text-2xl font-extrabold tracking-tight bg-gradient-to-r from-violet-600 via-fuchsia-500 to-coral-500 bg-clip-text text-transparent">
          Trendit
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
          <span>Connecting to Trendit...</span>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <Routes>
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }

  return (
    <SocialDataProvider>
      <CallProvider>
        <ScrollToTopOnRouteChange />
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<FeedPage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/reels" element={<ReelsPage />} />
            <Route path="/post/:postId" element={<PostDetailPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:uid" element={<MessagesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/bookmarks" element={<BookmarksPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/:uid" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </CallProvider>
    </SocialDataProvider>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
