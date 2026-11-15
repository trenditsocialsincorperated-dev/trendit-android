import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, verifyFirestoreConnection } from '@/services/firebase';
import { checkOAuthRedirectResult, ensureUserProfileDocument, logoutUser } from '@/services/authService';
import { persistBookmarks, subscribeToFollowingIds } from '@/services/userService';
import type { UserProfile } from '@/types';

interface AuthContextValue {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  followingIds: string[];
  bookmarkedIds: string[];
  isBookmarked: (postId: string) => boolean;
  toggleBookmark: (postId: string) => void;
  isFollowingUser: (uid: string) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  userProfile: null,
  loading: true,
  followingIds: [],
  bookmarkedIds: [],
  isBookmarked: () => false,
  toggleBookmark: () => {},
  isFollowingUser: () => false,
  signOut: async () => {},
});

function readLocalBookmarks(): string[] {
  try {
    const raw = localStorage.getItem('trendit_bookmarks');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(readLocalBookmarks);

  useEffect(() => {
    verifyFirestoreConnection();
    checkOAuthRedirectResult();

    let unsubProfile: (() => void) | null = null;
    let unsubFollowing: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (unsubFollowing) {
        unsubFollowing();
        unsubFollowing = null;
      }

      setFirebaseUser(user);

      if (!user) {
        setUserProfile(null);
        setFollowingIds([]);
        setLoading(false);
        return;
      }

      try {
        const initial = await ensureUserProfileDocument(user);
        setUserProfile(initial);
      } catch (err) {
        console.warn('Profile bootstrap warning:', err);
      }

      unsubProfile = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => {
          if (snap.exists()) {
            const data = { uid: snap.id, ...(snap.data() as Omit<UserProfile, 'uid'>) };
            setUserProfile(data);
            if (Array.isArray(data.bookmarkedPostIds) && data.bookmarkedPostIds.length > 0) {
              setBookmarkedIds((prev) => {
                const merged = Array.from(new Set([...prev, ...(data.bookmarkedPostIds || [])]));
                localStorage.setItem('trendit_bookmarks', JSON.stringify(merged));
                return merged;
              });
            }
          }
          setLoading(false);
        },
        () => {
          setLoading(false);
        }
      );

      unsubFollowing = subscribeToFollowingIds(user.uid, (ids) => {
        setFollowingIds(ids);
      });
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
      if (unsubFollowing) unsubFollowing();
    };
  }, []);

  const isBookmarked = useCallback(
    (postId: string) => bookmarkedIds.includes(postId),
    [bookmarkedIds]
  );

  const toggleBookmark = useCallback(
    (postId: string) => {
      setBookmarkedIds((prev) => {
        const next = prev.includes(postId)
          ? prev.filter((id) => id !== postId)
          : [postId, ...prev];
        persistBookmarks(firebaseUser?.uid || '', next);
        return next;
      });
    },
    [firebaseUser?.uid]
  );

  const isFollowingUser = useCallback(
    (uid: string) => Boolean(uid && followingIds.includes(uid)),
    [followingIds]
  );

  const signOut = useCallback(async () => {
    await logoutUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        loading,
        followingIds,
        bookmarkedIds,
        isBookmarked,
        toggleBookmark,
        isFollowingUser,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  return useContext(AuthContext);
}
