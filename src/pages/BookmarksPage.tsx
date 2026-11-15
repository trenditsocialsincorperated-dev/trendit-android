import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Loader2, Search, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocialData } from '@/contexts/SocialDataContext';
import { PostCard } from '@/components/feed/PostCard';

export const BookmarksPage: React.FC = () => {
  const navigate = useNavigate();
  const { bookmarkedIds } = useAuth();
  const { posts, postsLoading } = useSocialData();
  const [queryText, setQueryText] = useState('');

  const savedPosts = useMemo(() => {
    const idOrder = new Map<string, number>();
    bookmarkedIds.forEach((id, idx) => idOrder.set(id, idx));

    const matched = posts
      .filter((p) => idOrder.has(p.id))
      .sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

    const q = queryText.trim().toLowerCase();
    if (!q) return matched;

    return matched.filter(
      (p) =>
        p.text.toLowerCase().includes(q) ||
        p.displayName.toLowerCase().includes(q) ||
        p.handle.toLowerCase().includes(q)
    );
  }, [posts, bookmarkedIds, queryText]);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white dark:bg-[#11141D] border border-slate-200/85 dark:border-slate-800/85 p-5 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Saved Posts
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {bookmarkedIds.length} bookmarked post{bookmarkedIds.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {bookmarkedIds.length > 0 && (
          <div className="relative mt-4">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Filter your saved posts..."
              className="w-full h-11 pl-10 pr-9 rounded-2xl bg-slate-100/90 dark:bg-[#0B0E15] border border-transparent focus:border-violet-500 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            />
            {queryText && (
              <button
                type="button"
                onClick={() => setQueryText('')}
                aria-label="Clear filter"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {postsLoading ? (
        <div className="py-16 flex items-center justify-center text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin" />
        </div>
      ) : savedPosts.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-[#11141D] border border-slate-200/85 dark:border-slate-800/85 px-6 py-16 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-violet-600/10 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto mb-3.5">
            <Bookmark className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {queryText ? 'No saved posts match your search' : 'No saved posts yet'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1.5 leading-relaxed">
            {queryText
              ? 'Try clearing your search filter to see all bookmarked posts.'
              : 'Tap the bookmark icon on any post in your feed to save it here for quick access.'}
          </p>
          {!queryText && (
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mt-5 min-h-[42px] px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Browse Feed
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {savedPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
};
