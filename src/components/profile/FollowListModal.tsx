import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { getFollowUserProfiles, toggleFollowUser } from '@/services/userService';
import type { UserProfile } from '@/types';

interface FollowListModalProps {
  uid: string;
  kind: 'followers' | 'following' | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export const FollowListModal: React.FC<FollowListModalProps> = ({
  uid,
  kind,
  onClose,
  onUpdated,
}) => {
  const navigate = useNavigate();
  const { userProfile, isFollowingUser } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  useEffect(() => {
    if (!kind || !uid) return;
    let active = true;
    setLoading(true);
    getFollowUserProfiles(uid, kind).then((list) => {
      if (active) {
        setUsers(list);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [uid, kind]);

  if (!kind) return null;

  const handleToggleFollow = async (target: UserProfile) => {
    if (!userProfile || busyUid) return;
    setBusyUid(target.uid);
    try {
      await toggleFollowUser(userProfile, target.uid);
      onUpdated?.();
    } catch {
      showToast('Could not update follow status.', 'error');
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#121622] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white capitalize">
            {kind}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
          {loading ? (
            <div className="py-12 flex items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 px-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No {kind} yet.
            </div>
          ) : (
            users.map((u) => {
              const following = isFollowingUser(u.uid);
              const isSelf = u.uid === userProfile?.uid;

              return (
                <div
                  key={u.uid}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate(isSelf ? '/profile' : `/profile/${u.uid}`);
                    }}
                    className="flex items-center gap-3 min-w-0 text-left flex-1"
                  >
                    <UserAvatar user={u} size="md" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {u.displayName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        @{u.handle}
                      </div>
                    </div>
                  </button>

                  {!isSelf && (
                    <button
                      type="button"
                      disabled={busyUid === u.uid}
                      onClick={() => handleToggleFollow(u)}
                      className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        following
                          ? 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-rose-500 hover:text-rose-500'
                          : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90'
                      }`}
                    >
                      {following ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
