import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Heart,
  MessageCircle,
  PhoneCall,
  Send,
  UserPlus,
} from 'lucide-react';
import { useSocialData } from '@/contexts/SocialDataContext';
import { useToast } from '@/contexts/ToastContext';
import { UserAvatar } from '@/components/ui/UserAvatar';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notificationService';
import type { AppNotification } from '@/types';
import { formatTimeAgo } from '@/utils/formatters';

type NotifFilter = 'all' | 'likes' | 'replies' | 'follows' | 'direct';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { notifications, unreadNotificationsCount } = useSocialData();
  const { showToast } = useToast();

  const [filter, setFilter] = useState<NotifFilter>('all');
  const [markingAll, setMarkingAll] = useState(false);

  const filteredNotifications = useMemo(() => {
    switch (filter) {
      case 'likes':
        return notifications.filter((n) => n.type === 'like');
      case 'replies':
        return notifications.filter((n) => n.type === 'reply' || n.type === 'comment');
      case 'follows':
        return notifications.filter((n) => n.type === 'follow');
      case 'direct':
        return notifications.filter((n) => n.type === 'dm' || n.type === 'call');
      default:
        return notifications;
    }
  }, [notifications, filter]);

  const handleMarkAllRead = async () => {
    if (unreadNotificationsCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(notifications);
      showToast('All notifications marked as read.', 'success');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleSelectNotification = async (notif: AppNotification) => {
    if (!notif.read) {
      markNotificationRead(notif.id);
    }

    if (notif.postId) {
      navigate(`/post/${notif.postId}`);
      return;
    }

    if (notif.type === 'dm' || notif.type === 'call') {
      navigate(`/messages/${notif.senderUid}`);
      return;
    }

    if (notif.senderUid) {
      navigate(`/profile/${notif.senderUid}`);
    }
  };

  const renderTypeIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'like':
        return (
          <div className="w-7 h-7 rounded-full bg-coral-500/15 text-coral-500 flex items-center justify-center shrink-0">
            <Heart className="w-3.5 h-3.5 fill-current" />
          </div>
        );
      case 'reply':
      case 'comment':
        return (
          <div className="w-7 h-7 rounded-full bg-electric-500/15 text-electric-500 flex items-center justify-center shrink-0">
            <MessageCircle className="w-3.5 h-3.5" />
          </div>
        );
      case 'follow':
        return (
          <div className="w-7 h-7 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
            <UserPlus className="w-3.5 h-3.5" />
          </div>
        );
      case 'call':
        return (
          <div className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <PhoneCall className="w-3.5 h-3.5" />
          </div>
        );
      case 'dm':
      default:
        return (
          <div className="w-7 h-7 rounded-full bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400 flex items-center justify-center shrink-0">
            <Send className="w-3.5 h-3.5" />
          </div>
        );
    }
  };

  const tabs: { id: NotifFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'likes', label: 'Likes' },
    { id: 'replies', label: 'Replies' },
    { id: 'follows', label: 'Follows' },
    { id: 'direct', label: 'Calls & DMs' },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white dark:bg-[#11141D] border border-slate-200/85 dark:border-slate-800/85 shadow-xs overflow-hidden">
        <div className="px-5 pt-5 pb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Notifications
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {unreadNotificationsCount > 0
                ? `${unreadNotificationsCount} unread update${
                    unreadNotificationsCount === 1 ? '' : 's'
                  }`
                : 'Real-time activity across your posts, follows, and calls'}
            </p>
          </div>

          {unreadNotificationsCount > 0 && (
            <button
              type="button"
              disabled={markingAll}
              onClick={handleMarkAllRead}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <CheckCheck className="w-4 h-4 text-violet-500" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {/* Filter Bar */}
        <div className="px-5 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`relative min-h-[44px] px-3.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'text-violet-600 dark:text-violet-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
                {active && (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-violet-600 to-coral-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Notification Items */}
        {filteredNotifications.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-violet-600/10 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto mb-3.5">
              <Bell className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Nothing here yet
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1">
              When someone likes your post, replies, follows you, or calls you, it will appear live right here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {filteredNotifications.map((notif) => (
              <button
                key={notif.id}
                type="button"
                onClick={() => handleSelectNotification(notif)}
                className={`w-full px-5 py-4 flex items-start gap-3.5 text-left transition-colors ${
                  !notif.read
                    ? 'bg-violet-600/[0.05] dark:bg-violet-500/[0.08] hover:bg-violet-600/[0.08] dark:hover:bg-violet-500/[0.12]'
                    : 'hover:bg-slate-50 dark:hover:bg-white/[0.025]'
                }`}
              >
                <div className="relative shrink-0 mt-0.5">
                  <UserAvatar
                    src={notif.senderAvatar}
                    name={notif.senderName || notif.senderHandle}
                    user={{
                      uid: notif.senderUid,
                      displayName: notif.senderName || notif.senderHandle,
                      handle: notif.senderHandle,
                      photoURL: notif.senderAvatar || null,
                    }}
                    size="md"
                  />
                  <div className="absolute -bottom-1 -right-1 ring-2 ring-white dark:ring-[#11141D] rounded-full">
                    {renderTypeIcon(notif.type)}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                      @{notif.senderHandle || 'user'}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                      {formatTimeAgo(notif.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-900 dark:text-slate-100 mt-0.5 leading-snug">
                    {notif.text}
                  </p>
                </div>

                {!notif.read && (
                  <span
                    aria-label="Unread"
                    className="w-2.5 h-2.5 rounded-full bg-violet-600 dark:bg-violet-400 mt-2 shrink-0"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
