import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocialData } from '@/contexts/SocialDataContext';
import { useToast } from '@/contexts/ToastContext';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { getSuggestedUsers, toggleFollowUser } from '@/services/userService';
import type { UserProfile } from '@/types';

export const RightDiscoverySidebar: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile, followingIds, isFollowingUser } = useAuth();
  const { trendingTopics } = useSocialData();
  const { showToast } = useToast();

  const [queryText, setQueryText] = useState('');
  const [suggested, setSuggested] = useState<UserProfile[]>([]);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile?.uid) return;
    let active = true;
    getSuggestedUsers(userProfile.uid, followingIds, 4).then((list) => {
      if (active) setSuggested(list);
    });
    return () => {
      active = false;
    };
  }, [userProfile?.uid, followingIds]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryText.trim()) {
      navigate('/explore');
      return;
    }
    navigate(`/explore?q=${encodeURIComponent(queryText.trim())}`);
  };

  const handleFollow = async (target: UserProfile) => {
    if (!userProfile || busyUid) return;
    setBusyUid(target.uid);
    try {
      const res = await toggleFollowUser(userProfile, target.uid);
      showToast(
        res.isFollowing ? `Following @${target.handle}` : `Unfollowed @${target.handle}`,
        'info'
      );
    } catch {
      showToast('Could not update follow status.', 'error');
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <aside className="hidden lg:flex flex-col gap-5 w-80 shrink-0 sticky top-6 self-start">
      {/* Quick Search */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Search Trendit..."
          className="w-full h-11 pl-10 pr-4 rounded-2xl bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 transition-colors"
        />
      </form>

      {/* Live Trending Topics */}
      <section className="bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Trending Now
          </h2>
          <button
            type="button"
            onClick={() => navigate('/explore')}
            className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline inline-flex items-center gap-0.5"
          >
            <span>Explore</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
          {trendingTopics.slice(0, 5).map((topic) => (
            <button
              key={topic.tag}
              type="button"
              onClick={() => navigate(`/explore?q=${encodeURIComponent(topic.tag)}`)}
              className="w-full py-2.5 text-left group block"
            >
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {topic.category}
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                {topic.tag}
              </div>
              {topic.postsCount > 0 && (
                <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                  {topic.postsCount} {topic.postsCount === 1 ? 'post' : 'posts'}
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Suggested People */}
      {suggested.length > 0 && (
        <section className="bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3.5">
            Who to Follow
          </h2>
          <div className="space-y-3.5">
            {suggested.map((person) => {
              const followed = isFollowingUser(person.uid);
              return (
                <div key={person.uid} className="flex items-center justify-between gap-2.5">
                  <button
                    type="button"
                    onClick={() => navigate(`/profile/${person.uid}`)}
                    className="flex items-center gap-2.5 min-w-0 text-left flex-1"
                  >
                    <UserAvatar user={person} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {person.displayName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        @{person.handle}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={busyUid === person.uid}
                    onClick={() => handleFollow(person)}
                    className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      followed
                        ? 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                        : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90'
                    }`}
                  >
                    {followed ? 'Following' : 'Follow'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </aside>
  );
};
