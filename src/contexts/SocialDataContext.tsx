import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { computeTrendingFromPosts, subscribeToFeedPosts } from '@/services/postService';
import { subscribeToStories } from '@/services/storyService';
import { subscribeToNotifications } from '@/services/notificationService';
import type {
  AppNotification,
  MediaType,
  Post,
  RepostPreview,
  Story,
  TrendingTopic,
} from '@/types';

interface LightboxMedia {
  url: string;
  type: MediaType;
  caption?: string;
}

interface SocialDataContextValue {
  posts: Post[];
  postsLoading: boolean;
  stories: Story[];
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  trendingTopics: TrendingTopic[];
  lightboxMedia: LightboxMedia | null;
  openLightbox: (url: string, type?: MediaType, caption?: string) => void;
  closeLightbox: () => void;
  composerModalOpen: boolean;
  quotePostTarget: RepostPreview | null;
  openComposerModal: (quote?: RepostPreview | null) => void;
  closeComposerModal: () => void;
}

const SocialDataContext = createContext<SocialDataContextValue>({
  posts: [],
  postsLoading: true,
  stories: [],
  notifications: [],
  unreadNotificationsCount: 0,
  trendingTopics: [],
  lightboxMedia: null,
  openLightbox: () => {},
  closeLightbox: () => {},
  composerModalOpen: false,
  quotePostTarget: null,
  openComposerModal: () => {},
  closeComposerModal: () => {},
});

export const SocialDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [rawStories, setRawStories] = useState<Story[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [lightboxMedia, setLightboxMedia] = useState<LightboxMedia | null>(null);
  const [composerModalOpen, setComposerModalOpen] = useState(false);
  const [quotePostTarget, setQuotePostTarget] = useState<RepostPreview | null>(null);

  useEffect(() => {
    if (!firebaseUser) {
      setPosts([]);
      setRawStories([]);
      setNotifications([]);
      setUnreadNotificationsCount(0);
      setPostsLoading(false);
      return;
    }

    setPostsLoading(true);
    const unsubPosts = subscribeToFeedPosts((items) => {
      setPosts(items);
      setPostsLoading(false);
    });

    const unsubStories = subscribeToStories((items) => {
      setRawStories(items);
    });

    const unsubNotifs = subscribeToNotifications(firebaseUser.uid, (items, unread) => {
      setNotifications(items);
      setUnreadNotificationsCount(unread);
    });

    return () => {
      unsubPosts();
      unsubStories();
      unsubNotifs();
    };
  }, [firebaseUser]);

  // Combine dedicated 24h stories with recent visual media highlights from posts if few stories exist
  const stories = useMemo<Story[]>(() => {
    if (rawStories.length > 0) return rawStories;

    const seenUsers = new Set<string>();
    const derived: Story[] = [];
    for (const post of posts) {
      if (!post.mediaUrl || (post.mediaType !== 'image' && post.mediaType !== 'video')) continue;
      if (seenUsers.has(post.uid)) continue;
      seenUsers.add(post.uid);
      derived.push({
        id: `post_${post.id}`,
        uid: post.uid,
        displayName: post.displayName,
        handle: post.handle,
        userPhotoURL: post.userPhotoURL,
        mediaUrl: post.mediaUrl,
        mediaType: post.mediaType,
        caption: post.text || '',
        createdAt: post.createdAt,
      });
      if (derived.length >= 12) break;
    }
    return derived;
  }, [rawStories, posts]);

  const trendingTopics = useMemo(() => computeTrendingFromPosts(posts), [posts]);

  const openLightbox = (url: string, type: MediaType = 'image', caption?: string) => {
    setLightboxMedia({ url, type, caption });
  };

  const closeLightbox = () => setLightboxMedia(null);

  const openComposerModal = (quote: RepostPreview | null = null) => {
    setQuotePostTarget(quote);
    setComposerModalOpen(true);
  };

  const closeComposerModal = () => {
    setComposerModalOpen(false);
    setQuotePostTarget(null);
  };

  return (
    <SocialDataContext.Provider
      value={{
        posts,
        postsLoading,
        stories,
        notifications,
        unreadNotificationsCount,
        trendingTopics,
        lightboxMedia,
        openLightbox,
        closeLightbox,
        composerModalOpen,
        quotePostTarget,
        openComposerModal,
        closeComposerModal,
      }}
    >
      {children}
    </SocialDataContext.Provider>
  );
};

export function useSocialData() {
  return useContext(SocialDataContext);
}
