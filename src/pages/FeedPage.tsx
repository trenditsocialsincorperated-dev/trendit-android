import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocialData } from '@/contexts/SocialDataContext';
import { StoriesBar } from '@/components/feed/StoriesBar';
import { PostComposer } from '@/components/feed/PostComposer';
import { PostCard } from '@/components/feed/PostCard';

export const FeedPage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile, followingIds } = useAuth();
  const { posts, postsLoading } = useSocialData();
  const [feedTab, setFeedTab] = useState<'foryou' | 'following'>('foryou');

  const visiblePosts = useMemo(() => {
    if (feedTab === 'following') {
      const uid = userProfile?.uid || '';
      return posts.filter((p) => p.uid === uid || followingIds.includes(p.uid));
    }
    return posts;
  }, [posts, feedTab, followingIds, userProfile?.uid]);

  return (
    <div className="space-y-4">
      {/* Stories Carousel */}
      <StoriesBar />

      {/* Feed Filter Control */}
      <div className="bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-1.5 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setFeedTab('foryou')}
          className={`flex-1 min-h-[40px] rounded-xl text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
            feedTab === 'foryou'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          For You
        </button>
        <button
          type="button"
          onClick={() => setFeedTab('following')}
          className={`flex-1 min-h-[40px] rounded-xl text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
            feedTab === 'following'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Following
        </button>
      </div>

      {/* Inline Post Composer */}
      <PostComposer />

      {/* Feed Stream */}
      {postsLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 animate-pulse space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="space-y-2 flex-1">
                  <div className="h-3.5 w-36 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800" />
                </div>
              </div>
              <div className="h-4 w-4/5 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
            </div>
          ))}
        </div>
      ) : visiblePosts.length === 0 ? (
        <div className="bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto">
            {feedTab === 'following' ? (
              <Compass className="w-6 h-6" />
            ) : (
              <Sparkles className="w-6 h-6" />
            )}
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {feedTab === 'following'
              ? 'Your Following feed is quiet'
              : 'Be the first to start a conversation'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {feedTab === 'following'
              ? 'Follow creators and friends on Trendit to see their latest posts, polls, and media right here.'
              : 'Share a thought, photo, video, or poll above to kick off the feed.'}
          </p>
          {feedTab === 'following' && (
            <button
              type="button"
              onClick={() => navigate('/explore')}
              className="mt-2 min-h-[42px] px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Discover People
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {visiblePosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
};
