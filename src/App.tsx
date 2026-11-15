import React, { useEffect } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
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

const ScrollToTopOnRouteChange: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  return null;
};

const AppRoutes: React.FC = () => {
  const { firebaseUser, loading } = useAuth();

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
