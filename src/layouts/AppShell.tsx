import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Compass,
  Clapperboard,
  MessageSquare,
  Bell,
  Bookmark,
  User,
  Settings,
  Plus,
  Sun,
  Moon,
  WifiOff,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSocialData } from '@/contexts/SocialDataContext';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { LightboxModal } from '@/components/ui/LightboxModal';
import { CallOverlay } from '@/components/call/CallOverlay';
import { PostComposer } from '@/components/feed/PostComposer';
import { RightDiscoverySidebar } from '@/components/navigation/RightDiscoverySidebar';

export const AppShell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { userProfile } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const {
    unreadNotificationsCount,
    composerModalOpen,
    quotePostTarget,
    openComposerModal,
    closeComposerModal,
  } = useSocialData();

  const hideRightSidebar =
    location.pathname.startsWith('/messages') || location.pathname.startsWith('/reels');

  const desktopNavItems = [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/explore', label: 'Explore', icon: Compass },
    { to: '/reels', label: 'Reels', icon: Clapperboard },
    { to: '/messages', label: 'Messages', icon: MessageSquare },
    {
      to: '/notifications',
      label: 'Notifications',
      icon: Bell,
      badge: unreadNotificationsCount,
    },
    { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
    { to: '/profile', label: 'Profile', icon: User },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const mobileTabs = [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/explore', label: 'Explore', icon: Compass },
    { to: '/reels', label: 'Reels', icon: Clapperboard },
    { to: '/messages', label: 'Messages', icon: MessageSquare },
    { to: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090B10] text-slate-900 dark:text-slate-100">
      {/* Subtle Ambient Top Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-gradient-to-b from-violet-600/[0.06] via-fuchsia-500/[0.02] to-transparent dark:from-violet-600/[0.09] dark:via-fuchsia-500/[0.03]"
      />

      {/* Offline Connectivity Banner */}
      {!isOnline && (
        <div className="sticky top-0 z-50 bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>Offline mode — showing cached content until connection returns.</span>
        </div>
      )}

      {/* Mobile Compact Sticky Top Bar (< 768px) */}
      <header className="md:hidden sticky top-0 z-30 h-14 px-4 pt-safe bg-white/85 dark:bg-[#090B10]/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="font-display text-xl font-extrabold tracking-tight bg-gradient-to-r from-violet-600 via-fuchsia-500 to-coral-500 bg-clip-text text-transparent whitespace-nowrap shrink-0"
        >
          Trendit
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => openComposerModal(null)}
            aria-label="Create post"
            className="min-h-[42px] min-w-[42px] rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
          >
            <Plus className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/notifications')}
            aria-label="Notifications"
            className="relative min-h-[42px] min-w-[42px] rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
          >
            <Bell className="w-5 h-5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-coral-500 text-white text-[10px] font-bold tabular-nums flex items-center justify-center">
                {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/settings')}
            aria-label="Settings"
            className="min-h-[42px] min-w-[42px] rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Responsive Multi-Column Container */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 pb-24 md:py-6 flex gap-6 items-start">
        {/* Desktop & Tablet Left Navigation Rail */}
        <aside className="hidden md:flex flex-col justify-between w-20 xl:w-60 shrink-0 sticky top-6 min-h-[calc(100vh-3rem)]">
          <div className="space-y-6">
            {/* Brand Wordmark */}
            <div className="px-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0"
              >
                <img
                  src="/icon-192.png"
                  alt="Trendit icon"
                  className="w-9 h-9 rounded-xl object-cover shadow-sm shrink-0"
                />
                <span className="hidden xl:inline font-display text-2xl font-extrabold tracking-tight bg-gradient-to-r from-violet-600 via-fuchsia-500 to-coral-500 bg-clip-text text-transparent">
                  Trendit
                </span>
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                className="hidden xl:flex w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11141D] text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 items-center justify-center transition-colors"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>

            {/* Primary Nav Links */}
            <nav className="space-y-1">
              {desktopNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `group flex items-center justify-center xl:justify-start gap-3.5 min-h-[46px] px-3.5 py-2.5 rounded-2xl text-sm font-semibold transition-colors whitespace-nowrap shrink-0 relative ${
                        isActive
                          ? 'bg-violet-600/12 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-slate-100'
                      }`
                    }
                  >
                    <div className="relative">
                      <Icon className="w-5 h-5 shrink-0" />
                      {Boolean(item.badge && item.badge > 0) && (
                        <span className="xl:hidden absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-coral-500 text-white text-[10px] font-bold tabular-nums flex items-center justify-center">
                          {item.badge! > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </div>
                    <span className="hidden xl:inline">{item.label}</span>
                    {Boolean(item.badge && item.badge > 0) && (
                      <span className="hidden xl:inline-flex ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-coral-500 text-white text-[11px] font-bold tabular-nums items-center justify-center">
                        {item.badge! > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* Primary Create CTA */}
            <button
              type="button"
              onClick={() => openComposerModal(null)}
              className="w-full min-h-[46px] px-4 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-coral-500 text-white font-semibold text-sm shadow-md shadow-violet-600/20 hover:opacity-95 transition-opacity flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
              <span className="hidden xl:inline">Create Post</span>
            </button>
          </div>

          {/* Signed-in User Card */}
          {userProfile && (
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="mt-6 flex items-center justify-center xl:justify-start gap-3 p-2.5 rounded-2xl bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80 hover:border-violet-500/40 transition-colors text-left"
            >
              <UserAvatar user={userProfile} size="sm" />
              <div className="hidden xl:block min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {userProfile.displayName}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  @{userProfile.handle}
                </div>
              </div>
            </button>
          )}
        </aside>

        {/* Center Content Stream */}
        <main
          className={`flex-1 min-w-0 ${
            hideRightSidebar ? 'max-w-5xl' : 'max-w-2xl'
          } mx-auto w-full`}
        >
          <Outlet />
        </main>

        {/* Right Discovery Rail (Desktop) */}
        {!hideRightSidebar && <RightDiscoverySidebar />}
      </div>

      {/* Mobile Fixed Bottom Navigation Anchor (< 768px) */}
      <nav
        aria-label="Primary mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/92 dark:bg-[#090B10]/92 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 pb-safe"
      >
        <div className="grid grid-cols-5 items-center h-15">
          {mobileTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                    isActive
                      ? 'text-violet-600 dark:text-violet-400 font-semibold'
                      : 'text-slate-500 dark:text-slate-400'
                  }`
                }
              >
                <Icon className="w-[21px] h-[21px]" />
                <span className="text-[10px] tracking-tight whitespace-nowrap">{tab.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Global Create / Quote Post Modal */}
      {composerModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={closeComposerModal}
          className="fixed inset-0 z-[85] bg-black/65 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 pt-14 sm:pt-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-3xl bg-white dark:bg-[#11141D] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {quotePostTarget ? 'Quote Post' : 'Create Post'}
              </h3>
              <button
                type="button"
                onClick={closeComposerModal}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2">
              <PostComposer
                compact
                quotePost={quotePostTarget}
                onClearQuote={() => openComposerModal(null)}
                onSuccess={closeComposerModal}
              />
            </div>
          </div>
        </div>
      )}

      {/* Global Media Lightbox & Agora Live Call Studio */}
      <LightboxModal />
      <CallOverlay />
    </div>
  );
};
