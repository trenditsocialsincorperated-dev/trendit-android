import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocialData } from '@/contexts/SocialDataContext';
import { useToast } from '@/contexts/ToastContext';
import { PostCard } from '@/components/feed/PostCard';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { searchAllUsers, toggleFollowUser } from '@/services/userService';
import type { UserProfile } from '@/types';

export const ExplorePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { userProfile, isFollowingUser } = useAuth();
  const { posts, trendingTopics } = useSocialData();
  const { showToast } = useToast();

  const initialQuery = searchParams.get('q') || '';
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<'top' | 'people' | 'media'>('top');
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  useEffect(() => {
    setSearchTerm(searchParams.get('q') || '');
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    setPeopleLoading(true);
    searchAllUsers(searchTerm, userProfile?.uid).then((list) => {
      if (active) {
        setPeople(list);
        setPeopleLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [searchTerm, userProfile?.uid]);

  const filteredPosts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return posts.filter((post) => {
      if (activeTab === 'media' && !post.mediaUrl) return false;
      if (!q) return true;
      return (
        (post.text || '').toLowerCase().includes(q) ||
        (post.displayName || '').toLowerCase().includes(q) ||
        (post.handle || '').toLowerCase().includes(q)
      );
    });
  }, [posts, searchTerm, activeTab]);

  const updateQuery = (value: string) => {
    setSearchTerm(value);
    if (value.trim()) {
      setSearchParams({ q: value }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const handleFollowToggle = async (person: UserProfile) => {
    if (!userProfile || busyUid) return;
    setBusyUid(person.uid);
    try {
      const res = await toggleFollowUser(userProfile, person.uid);
      showToast(
        res.isFollowing ? `Following @${person.handle}` : `Unfollowed @${person.handle}`,
        'info'
      );
    } catch {
      showToast('Could not update follow status.', 'error');
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Bar & Tabs */}
      <div className="bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 space-y-3.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => updateQuery(e.target.value)}
            placeholder="Search posts, #hashtags, or @people..."
            className="w-full h-11 pl-10 pr-10 rounded-xl bg-slate-50 dark:bg-[#0B0E15] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-violet-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => updateQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Interactive Topic Filter Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {trendingTopics.map((topic) => {
            const active = searchTerm.toLowerCase() === topic.tag.toLowerCase();
            return (
              <button
                key={topic.tag}
                type="button"
                onClick={() => updateQuery(active ? '' : topic.tag)}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 dark:bg-[#161B28] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {topic.tag}
              </button>
            );
          })}
        </div>

        {/* Segmented View Selector */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#0B0E15]">
          {(
            [
              { id: 'top', label: 'Posts' },
              { id: 'people', label: `People (${people.length})` },
              { id: 'media', label: 'Media' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-h-[38px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-[#1A2030] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results Stream */}
      {activeTab === 'people' ? (
        <div className="bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
          {peopleLoading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
            </div>
          ) : people.length === 0 ? (
            <div className="py-12 px-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No people matched "{searchTerm}".
            </div>
          ) : (
            people.map((person) => {
              const following = isFollowingUser(person.uid);
              return (
                <div
                  key={person.uid}
                  className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/profile/${person.uid}`)}
                    className="flex items-center gap-3.5 min-w-0 text-left flex-1"
                  >
                    <UserAvatar user={person} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {person.displayName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        @{person.handle}
                      </div>
                      {person.bio && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-1">
                          {person.bio}
                        </p>
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={busyUid === person.uid}
                    onClick={() => handleFollowToggle(person)}
                    className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      following
                        ? 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                        : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90'
                    }`}
                  >
                    {following ? 'Following' : 'Follow'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-10 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {searchTerm
              ? `No ${activeTab === 'media' ? 'media ' : ''}posts matched "${searchTerm}".`
              : 'No posts available right now.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
};
