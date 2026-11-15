import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  writeBatch,
  increment,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { sendSocialNotification } from './notificationService';
import type {
  MediaType,
  PollData,
  Post,
  Reply,
  RepostPreview,
  TrendingTopic,
  UserProfile,
} from '@/types';
import { extractHashtags, toMillisSafe } from '@/utils/formatters';

export function subscribeToFeedPosts(onUpdate: (posts: Post[]) => void): Unsubscribe {
  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Post[] = [];
      snapshot.forEach((docSnap) => {
        const raw = docSnap.data();
        items.push({
          id: docSnap.id,
          uid: raw.uid || '',
          displayName: raw.displayName || 'User',
          handle: raw.handle || 'user',
          userPhotoURL: raw.userPhotoURL || null,
          text: raw.text || '',
          mediaUrl: raw.mediaUrl || null,
          mediaType: raw.mediaType || null,
          poll: raw.poll || null,
          likesCount: Number(raw.likesCount) || 0,
          likedBy: Array.isArray(raw.likedBy) ? raw.likedBy : [],
          repliesCount: Number(raw.repliesCount) || 0,
          sharesCount: Number(raw.sharesCount) || 0,
          repostOf: raw.repostOf || null,
          tags: Array.isArray(raw.tags) ? raw.tags : extractHashtags(raw.text || ''),
          createdAt: raw.createdAt || null,
        });
      });
      items.sort((a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt));
      onUpdate(items);
    },
    (err) => {
      console.error('Realtime feed listener error:', err);
    }
  );
}

export function subscribeToSinglePost(
  postId: string,
  onUpdate: (post: Post | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'posts', postId),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      const raw = snap.data();
      onUpdate({
        id: snap.id,
        uid: raw.uid || '',
        displayName: raw.displayName || 'User',
        handle: raw.handle || 'user',
        userPhotoURL: raw.userPhotoURL || null,
        text: raw.text || '',
        mediaUrl: raw.mediaUrl || null,
        mediaType: raw.mediaType || null,
        poll: raw.poll || null,
        likesCount: Number(raw.likesCount) || 0,
        likedBy: Array.isArray(raw.likedBy) ? raw.likedBy : [],
        repliesCount: Number(raw.repliesCount) || 0,
        sharesCount: Number(raw.sharesCount) || 0,
        repostOf: raw.repostOf || null,
        tags: Array.isArray(raw.tags) ? raw.tags : extractHashtags(raw.text || ''),
        createdAt: raw.createdAt || null,
      });
    },
    (err) => {
      console.warn('Single post listener error:', err);
      onUpdate(null);
    }
  );
}

export interface CreatePostInput {
  author: UserProfile;
  text: string;
  mediaUrl?: string | null;
  mediaType?: MediaType | null;
  pollOptions?: string[];
  repostOf?: RepostPreview | null;
}

export async function createNewPost({
  author,
  text,
  mediaUrl = null,
  mediaType = null,
  pollOptions = [],
  repostOf = null,
}: CreatePostInput): Promise<string> {
  const cleanText = text.trim();
  const validPollOpts = pollOptions.map((o) => o.trim()).filter(Boolean);

  let poll: PollData | null = null;
  if (validPollOpts.length >= 2) {
    poll = {
      options: validPollOpts.slice(0, 4).map((opt) => ({ text: opt, votes: 0 })),
      totalVotes: 0,
      voters: {},
    };
  }

  const payload: Record<string, any> = {
    uid: author.uid,
    displayName: author.displayName || 'User',
    handle: author.handle || 'user',
    userPhotoURL: author.photoURL || null,
    text: cleanText,
    mediaUrl: mediaUrl || null,
    mediaType: mediaType || null,
    poll,
    likesCount: 0,
    likedBy: [],
    repliesCount: 0,
    createdAt: serverTimestamp(),
  };

  if (repostOf) {
    payload.repostOf = repostOf;
  }

  const ref = await addDoc(collection(db, 'posts'), payload);
  return ref.id;
}

export async function voteOnPostPoll(
  postId: string,
  voterUid: string,
  optionIndex: number
): Promise<void> {
  const postRef = doc(db, 'posts', postId);
  const snap = await getDoc(postRef);
  if (!snap.exists()) return;

  const data = snap.data();
  if (!data?.poll?.options) return;

  const poll: PollData = {
    options: data.poll.options.map((opt: any) => ({ ...opt })),
    totalVotes: Number(data.poll.totalVotes) || 0,
    voters: { ...(data.poll.voters || {}) },
  };

  if (poll.voters[voterUid] !== undefined) return;
  if (!poll.options[optionIndex]) return;

  poll.voters[voterUid] = optionIndex;
  poll.options[optionIndex].votes = (Number(poll.options[optionIndex].votes) || 0) + 1;
  poll.totalVotes += 1;

  await updateDoc(postRef, { poll });
}

export async function toggleLikeOnPost(
  postId: string,
  currentUser: UserProfile
): Promise<void> {
  const postRef = doc(db, 'posts', postId);
  const snap = await getDoc(postRef);
  if (!snap.exists()) return;

  const data = snap.data();
  let likedBy: string[] = Array.isArray(data.likedBy) ? [...data.likedBy] : [];
  let likesCount = Number(data.likesCount) || 0;

  if (likedBy.includes(currentUser.uid)) {
    likedBy = likedBy.filter((id) => id !== currentUser.uid);
    likesCount = Math.max(0, likesCount - 1);
  } else {
    likedBy.push(currentUser.uid);
    likesCount += 1;

    if (data.uid && data.uid !== currentUser.uid) {
      sendSocialNotification({
        recipientUid: data.uid,
        sender: currentUser,
        type: 'like',
        text: `${currentUser.displayName} liked your post.`,
        postId,
      }).catch(() => {});
    }
  }

  await updateDoc(postRef, { likedBy, likesCount });
}

export async function deleteOwnPost(postId: string, currentUid: string): Promise<void> {
  const postRef = doc(db, 'posts', postId);
  const snap = await getDoc(postRef);
  if (!snap.exists()) return;
  if (snap.data()?.uid !== currentUid) {
    throw new Error('You can only delete your own posts.');
  }
  await deleteDoc(postRef);
}

export function subscribeToPostReplies(
  postId: string,
  onUpdate: (replies: Reply[]) => void
): Unsubscribe {
  const q = query(collection(db, 'posts', postId, 'replies'), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Reply[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: docSnap.id,
          uid: d.uid || '',
          displayName: d.displayName || 'User',
          handle: d.handle || 'user',
          userPhotoURL: d.userPhotoURL || null,
          text: d.text || '',
          createdAt: d.createdAt || null,
        });
      });
      onUpdate(items);
    },
    (err) => {
      console.warn('Replies listener error:', err);
    }
  );
}

export async function addPostReply(
  postId: string,
  postAuthorUid: string,
  author: UserProfile,
  text: string
): Promise<void> {
  const cleanText = text.trim();
  if (!cleanText) return;

  const batch = writeBatch(db);
  const replyRef = doc(collection(db, 'posts', postId, 'replies'));
  batch.set(replyRef, {
    uid: author.uid,
    displayName: author.displayName || 'User',
    handle: author.handle || 'user',
    userPhotoURL: author.photoURL || null,
    text: cleanText,
    createdAt: serverTimestamp(),
  });

  const postRef = doc(db, 'posts', postId);
  batch.update(postRef, {
    repliesCount: increment(1),
  });

  await batch.commit();

  if (postAuthorUid && postAuthorUid !== author.uid) {
    sendSocialNotification({
      recipientUid: postAuthorUid,
      sender: author,
      type: 'reply',
      text: `${author.displayName} replied to your post.`,
      postId,
    }).catch(() => {});
  }
}

export function computeTrendingFromPosts(posts: Post[]): TrendingTopic[] {
  const counts = new Map<string, number>();

  for (const post of posts) {
    const tags = extractHashtags(post.text);
    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  const dynamicTopics: TrendingTopic[] = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, postsCount], idx) => ({
      tag,
      category: idx === 0 ? 'Top Trend' : 'Community · Trending',
      postsCount,
    }));

  if (dynamicTopics.length >= 4) {
    return dynamicTopics;
  }

  // Supplement with Trendit's signature discovery topics counted against real posts
  const seedTopics: { tag: string; keyword: string; category: string }[] = [
    { tag: '#WebDev', keyword: 'web', category: 'Technology · Trending' },
    { tag: '#ArtificialIntelligence', keyword: 'ai', category: 'AI & Tech · Trending' },
    { tag: '#JavaScript', keyword: 'js', category: 'Coding · Popular' },
    { tag: '#Design', keyword: 'design', category: 'Creative · Trending' },
    { tag: '#Music', keyword: 'music', category: 'Culture · Popular' },
  ];

  const existingSet = new Set(dynamicTopics.map((t) => t.tag.toLowerCase()));
  for (const seed of seedTopics) {
    if (existingSet.has(seed.tag.toLowerCase())) continue;
    const matchCount = posts.filter((p) => {
      const lower = (p.text || '').toLowerCase();
      return lower.includes(seed.tag.toLowerCase()) || lower.includes(seed.keyword);
    }).length;
    dynamicTopics.push({
      tag: seed.tag,
      category: seed.category,
      postsCount: matchCount,
    });
    if (dynamicTopics.length >= 6) break;
  }

  return dynamicTopics;
}
