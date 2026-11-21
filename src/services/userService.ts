import {
  doc,
  getDoc,
  getDocs,
  collection,
  onSnapshot,
  writeBatch,
  updateDoc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { sendSocialNotification } from './notificationService';
import type { UserProfile } from '@/types';
import { getInitialAvatarSvgDataUri, getRawAvatarCandidate } from '@/utils/formatters';

const avatarResolutionCache = new Map<string, string>();

/**
 * Resolves user avatar URLs across Firebase Storage gs:// URIs, HTTPS URLs,
 * base64 data URIs, and deterministic SVG initial fallbacks (Zero-Broken-Image Policy).
 */
export async function resolveUserAvatarUrl(
  user?: Partial<UserProfile> | null,
  fallbackSeed = 'Trendit'
): Promise<string> {
  const raw = getRawAvatarCandidate(user);
  const label = user?.displayName || user?.handle || fallbackSeed;
  const seed = user?.uid || user?.handle || label;

  if (!raw) {
    return getInitialAvatarSvgDataUri(seed, label);
  }

  if (avatarResolutionCache.has(raw)) {
    return avatarResolutionCache.get(raw)!;
  }

  if (raw.startsWith('gs://')) {
    try {
      const resolved = await getDownloadURL(ref(storage, raw));
      avatarResolutionCache.set(raw, resolved);
      return resolved;
    } catch {
      return getInitialAvatarSvgDataUri(seed, label);
    }
  }

  avatarResolutionCache.set(raw, raw);
  return raw;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!uid) return null;
  const cleanUid = uid.trim();
  if (!cleanUid) return null;

  try {
    const snap = await getDoc(doc(db, 'users', cleanUid));
    if (!snap.exists()) return null;
    return { uid: snap.id, ...(snap.data() as Omit<UserProfile, 'uid'>) };
  } catch (err) {
    console.warn('Failed to fetch user profile:', err);
    return null;
  }
}

export function subscribeToFollowingIds(
  uid: string,
  onUpdate: (followingIds: string[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', uid, 'following'),
    (snapshot) => {
      const ids: string[] = [];
      snapshot.forEach((docSnap) => ids.push(docSnap.id));
      onUpdate(ids);
    },
    (err) => {
      console.warn('Following listener error:', err);
    }
  );
}

export async function checkIsFollowing(currentUid: string, targetUid: string): Promise<boolean> {
  if (!currentUid || !targetUid || currentUid === targetUid) return false;
  try {
    const snap = await getDoc(doc(db, 'users', currentUid, 'following', targetUid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function toggleFollowUser(
  currentUser: UserProfile,
  targetUid: string
): Promise<{ isFollowing: boolean }> {
  if (!currentUser?.uid || !targetUid || currentUser.uid === targetUid) {
    return { isFollowing: false };
  }

  const myFollowingRef = doc(db, 'users', currentUser.uid, 'following', targetUid);
  const targetFollowerRef = doc(db, 'users', targetUid, 'followers', currentUser.uid);

  const existing = await getDoc(myFollowingRef);
  const currentlyFollowing = existing.exists();
  const batch = writeBatch(db);

  if (currentlyFollowing) {
    batch.delete(myFollowingRef);
    batch.delete(targetFollowerRef);
    await batch.commit();

    void sendSocialNotification({
      recipientUid: targetUid,
      sender: currentUser,
      type: 'unfollow',
      text: `${currentUser.displayName} unfollowed you.`,
    }).catch((err) => console.warn('Unfollow notification failed:', err));

    return { isFollowing: false };
  } else {
    batch.set(myFollowingRef, {
      uid: targetUid,
      createdAt: serverTimestamp(),
    });
    batch.set(targetFollowerRef, {
      uid: currentUser.uid,
      createdAt: serverTimestamp(),
    });
    await batch.commit();

    void sendSocialNotification({
      recipientUid: targetUid,
      sender: currentUser,
      type: 'follow',
      text: `${currentUser.displayName} started following you.`,
    }).catch((err) => console.warn('Follow notification failed:', err));

    return { isFollowing: true };
  }
}

export async function getFollowCounts(
  uid: string
): Promise<{ followersCount: number; followingCount: number }> {
  try {
    const [followingSnap, followersSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'following')),
      getDocs(collection(db, 'users', uid, 'followers')),
    ]);
    return {
      followingCount: followingSnap.size,
      followersCount: followersSnap.size,
    };
  } catch {
    return { followersCount: 0, followingCount: 0 };
  }
}

export async function getFollowUserProfiles(
  uid: string,
  kind: 'followers' | 'following'
): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'users', uid, kind));
    const ids = snap.docs.map((d) => d.id);
    const profiles = await Promise.all(ids.map((id) => getUserProfile(id)));
    return profiles
      .filter((p): p is UserProfile => p !== null)
      .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
  } catch {
    return [];
  }
}

export async function searchAllUsers(
  term: string,
  excludeUid?: string
): Promise<UserProfile[]> {
  const cleanTerm = term.trim().toLowerCase().replace(/^@/, '');
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    const results: UserProfile[] = [];
    snapshot.forEach((docSnap) => {
      if (excludeUid && docSnap.id === excludeUid) return;
      const data = { uid: docSnap.id, ...(docSnap.data() as Omit<UserProfile, 'uid'>) };
      if (!cleanTerm) {
        results.push(data);
        return;
      }
      const name = (data.displayName || '').toLowerCase();
      const handle = (data.handle || '').toLowerCase();
      const bio = (data.bio || '').toLowerCase();
      if (name.includes(cleanTerm) || handle.includes(cleanTerm) || bio.includes(cleanTerm)) {
        results.push(data);
      }
    });

    return results.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
  } catch (err) {
    console.warn('User search error:', err);
    return [];
  }
}

export async function getSuggestedUsers(
  currentUid: string,
  followingIds: string[],
  limitCount = 6
): Promise<UserProfile[]> {
  const all = await searchAllUsers('', currentUid);
  const notFollowed = all.filter((u) => !followingIds.includes(u.uid));
  return (notFollowed.length > 0 ? notFollowed : all).slice(0, limitCount);
}

export async function updateUserProfileData(
  uid: string,
  updates: Partial<UserProfile>
): Promise<void> {
  const sanitized: Record<string, any> = { ...updates };
  delete sanitized.uid;
  if (typeof sanitized.handle === 'string') {
    sanitized.handle = sanitized.handle
      .trim()
      .toLowerCase()
      .replace(/^@+/, '')
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 28);
  }
  await updateDoc(doc(db, 'users', uid), sanitized);
}

export async function persistBookmarks(uid: string, bookmarkedIds: string[]): Promise<void> {
  localStorage.setItem('trendit_bookmarks', JSON.stringify(bookmarkedIds));
  if (!uid) return;
  try {
    await updateDoc(doc(db, 'users', uid), {
      bookmarkedPostIds: bookmarkedIds.slice(0, 500),
    });
  } catch {
    // Keep localStorage bookmarks intact even if strict Firestore key rules reject extra field
  }
}
