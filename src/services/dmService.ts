import {
  collection,
  doc,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { getUserProfile, checkIsFollowing } from './userService';
import { sendSocialNotification } from './notificationService';
import type { CallType, DmMessage, DmThreadSummary, MediaType, UserProfile } from '@/types';
import { dmThreadId, toMillisSafe } from '@/utils/formatters';

export function subscribeToDmInbox(
  currentUid: string,
  onUpdate: (threads: DmThreadSummary[]) => void
): Unsubscribe {
  const q = query(collection(db, 'dmThreads'), where('participants', 'array-contains', currentUid));

  return onSnapshot(
    q,
    async (snapshot) => {
      const results: DmThreadSummary[] = [];

      await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data() || {};
          const participants: string[] = Array.isArray(data.participants) ? data.participants : [];
          const otherUid = participants.find((id) => id !== currentUid);
          if (!otherUid) return;

          const user = await getUserProfile(otherUid);
          if (!user) return;

          results.push({
            threadId: docSnap.id,
            updatedAt: toMillisSafe(data.updatedAt),
            lastMessage: typeof data.lastMessage === 'string' ? data.lastMessage : undefined,
            user,
          });
        })
      );

      results.sort((a, b) => b.updatedAt - a.updatedAt);
      onUpdate(results);
    },
    (err) => {
      console.warn('DM inbox listener error:', err);
      onUpdate([]);
    }
  );
}

export function subscribeToThreadMessages(
  threadId: string,
  onUpdate: (messages: DmMessage[]) => void
): Unsubscribe {
  const q = query(collection(db, 'dmThreads', threadId, 'messages'), orderBy('createdAt', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const msgs: DmMessage[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        msgs.push({
          id: docSnap.id,
          type: d.type || (d.mediaUrl ? 'media' : 'text'),
          senderUid: d.senderUid || '',
          recipientUid: d.recipientUid || '',
          text: d.text || '',
          mediaUrl: d.mediaUrl || null,
          mediaType: d.mediaType || null,
          callerUid: d.callerUid,
          calleeUid: d.calleeUid,
          callType: d.callType,
          callStatus: d.callStatus,
          durationSec: d.durationSec,
          createdAt: d.createdAt || null,
        });
      });
      onUpdate(msgs);
    },
    (err) => {
      console.warn('Thread messages listener error:', err);
      onUpdate([]);
    }
  );
}

export interface SendMessageParams {
  sender: UserProfile;
  recipientUid: string;
  text: string;
  mediaUrl?: string | null;
  mediaType?: MediaType | null;
}

export async function sendDirectMessageToUser({
  sender,
  recipientUid,
  text,
  mediaUrl = null,
  mediaType = null,
}: SendMessageParams): Promise<void> {
  const cleanText = text.trim();
  if (!cleanText && !mediaUrl) return;

  const followed = await checkIsFollowing(sender.uid, recipientUid);
  if (!followed) {
    throw new Error('Follow this person first to send a direct message.');
  }

  const threadId = dmThreadId(sender.uid, recipientUid);
  const threadRef = doc(db, 'dmThreads', threadId);

  await setDoc(
    threadRef,
    {
      participants: [sender.uid, recipientUid],
      lastMessage: cleanText || (mediaType === 'video' ? 'Sent a video' : mediaType === 'audio' ? 'Sent an audio clip' : 'Sent a photo'),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  const msgPayload: Record<string, any> = {
    senderUid: sender.uid,
    recipientUid,
    text: cleanText,
    createdAt: serverTimestamp(),
  };

  if (mediaUrl) {
    msgPayload.type = 'media';
    msgPayload.mediaUrl = mediaUrl;
    msgPayload.mediaType = mediaType || 'image';
  }

  await addDoc(collection(db, 'dmThreads', threadId, 'messages'), msgPayload);

  sendSocialNotification({
    recipientUid,
    sender,
    type: 'dm',
    text: `${sender.displayName} sent you a message: "${cleanText.slice(0, 60) || 'Attachment'}"`,
  }).catch(() => {});
}

export async function recordCallHistoryItem(params: {
  callId: string;
  callerUid: string;
  calleeUid: string;
  callType: CallType;
  callStatus: 'accepted' | 'declined';
  durationSec: number;
}): Promise<void> {
  const { callId, callerUid, calleeUid, callType, callStatus, durationSec } = params;
  const threadId = dmThreadId(callerUid, calleeUid);
  const historyRef = doc(db, 'dmThreads', threadId, 'messages', `call_${callId}`);

  await setDoc(historyRef, {
    type: 'call',
    senderUid: callerUid,
    recipientUid: calleeUid,
    callerUid,
    calleeUid,
    callType,
    callStatus,
    durationSec: Math.max(0, Math.round(durationSec || 0)),
    createdAt: serverTimestamp(),
  });
}
