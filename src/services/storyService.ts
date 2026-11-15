import {
  collection,
  addDoc,
  doc,
  updateDoc,
  arrayUnion,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Story, UserProfile } from '@/types';
import { toMillisSafe } from '@/utils/formatters';

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

export function subscribeToStories(
  onUpdate: (stories: Story[], permissionBlocked?: boolean) => void
): Unsubscribe {
  const q = query(collection(db, 'stories'), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const cutoff = Date.now() - STORY_TTL_MS;
      const active: Story[] = [];

      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const createdMs = toMillisSafe(d.createdAt) || Date.now();
        const expiresMs = Number(d.expiresAtMs) || createdMs + STORY_TTL_MS;
        if (expiresMs < Date.now() && createdMs < cutoff) return;

        active.push({
          id: docSnap.id,
          uid: d.uid || '',
          displayName: d.displayName || 'User',
          handle: d.handle || 'user',
          userPhotoURL: d.userPhotoURL || null,
          mediaUrl: d.mediaUrl || null,
          mediaType: d.mediaType || 'image',
          caption: d.caption || '',
          bgGradient: d.bgGradient || 'from-violet-600 via-fuchsia-500 to-rose-500',
          viewers: Array.isArray(d.viewers) ? d.viewers : [],
          createdAt: d.createdAt || null,
          expiresAtMs: expiresMs,
        });
      });

      onUpdate(active, false);
    },
    () => {
      // Gracefully report empty if `stories` collection rules are not open yet on an older ruleset
      onUpdate([], true);
    }
  );
}

export interface CreateStoryInput {
  author: UserProfile;
  mediaUrl?: string | null;
  mediaType: 'image' | 'video' | 'text';
  caption: string;
  bgGradient?: string;
}

export async function publishStory({
  author,
  mediaUrl = null,
  mediaType,
  caption,
  bgGradient = 'from-violet-600 via-fuchsia-500 to-rose-500',
}: CreateStoryInput): Promise<void> {
  await addDoc(collection(db, 'stories'), {
    uid: author.uid,
    displayName: author.displayName || 'User',
    handle: author.handle || 'user',
    userPhotoURL: author.photoURL || null,
    mediaUrl: mediaUrl || null,
    mediaType,
    caption: caption.trim(),
    bgGradient,
    viewers: [author.uid],
    expiresAtMs: Date.now() + STORY_TTL_MS,
    createdAt: serverTimestamp(),
  });
}

export async function markStoryAsViewed(storyId: string, viewerUid: string): Promise<void> {
  if (!storyId || !viewerUid || storyId.startsWith('post_')) return;
  try {
    await updateDoc(doc(db, 'stories', storyId), {
      viewers: arrayUnion(viewerUid),
    });
  } catch {
    // Ignore if story is derived or rules restrict viewer array updates
  }
}
