import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
  doc,
  updateDoc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { AppNotification, NotificationType, UserProfile } from '@/types';
import { toMillisSafe } from '@/utils/formatters';

export interface CreateNotificationParams {
  recipientUid: string;
  sender: UserProfile;
  type: NotificationType;
  text: string;
  postId?: string | null;
  callId?: string | null;
}

/**
 * Creates the in-app Firestore notification and requests FCM delivery from
 * the authenticated social-push backend. Push failures never break social actions.
 */
export async function sendSocialNotification({
  recipientUid,
  sender,
  type,
  text,
  postId = null,
  callId = null,
}: CreateNotificationParams): Promise<void> {
  if (!recipientUid || !sender?.uid || recipientUid === sender.uid) return;

  try {
    await addDoc(collection(db, 'notifications'), {
      recipientUid,
      senderUid: sender.uid,
      senderHandle: sender.handle || 'user',
      senderName: sender.displayName || 'Trendit User',
      senderAvatar: sender.photoURL || null,
      type,
      text,
      postId: postId || null,
      read: false,
      createdAt: serverTimestamp(),
    });

    const signedInUser = auth.currentUser;
    if (!signedInUser) {
      console.warn('Social push skipped: no signed-in Firebase user.');
      return;
    }

    const idToken = await signedInUser.getIdToken();
    const response = await fetch('/.netlify/functions/social-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        recipientUid,
        type,
        text,
        postId: postId || null,
        callId: callId || null,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.sent === false) {
      console.warn('Social push was not delivered:', {
        status: response.status,
        type,
        recipientUid,
        result,
      });
    } else {
      console.info('Social push backend response:', {
        status: response.status,
        type,
        recipientUid,
        result,
      });
    }
  } catch (err) {
    console.warn('Failed to create/send social notification:', err);
  }
}

export function subscribeToNotifications(
  uid: string,
  onUpdate: (notifications: AppNotification[], unreadCount: number) => void
): Unsubscribe {
  const q = query(collection(db, 'notifications'), where('recipientUid', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: AppNotification[] = [];
      let unread = 0;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Omit<AppNotification, 'id'>;
        if (!data.read) unread += 1;
        items.push({ id: docSnap.id, ...data });
      });

      items.sort((a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt));
      onUpdate(items, unread);
    },
    (err) => {
      console.warn('Notifications listener error:', err);
    }
  );
}

export async function markNotificationRead(notifId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notifId), { read: true });
  } catch (err) {
    console.warn('Could not mark notification read:', err);
  }
}

export async function markAllNotificationsRead(notifications: AppNotification[]): Promise<void> {
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return;

  try {
    const batch = writeBatch(db);
    unread.slice(0, 450).forEach((notif) => {
      batch.update(doc(db, 'notifications', notif.id), { read: true });
    });
    await batch.commit();
  } catch (err) {
    console.warn('Could not mark all notifications read:', err);
  }
}

/** Sends a data-only call lifecycle event so Android can stop its native call alert even when Trendit is backgrounded. */
export async function sendCallStatusPush(
  recipientUid: string,
  callId: string,
  callAction: 'ended' | 'declined' | 'accepted'
): Promise<void> {
  if (!recipientUid || !callId) return;
  const signedInUser = auth.currentUser;
  if (!signedInUser) return;
  try {
    const idToken = await signedInUser.getIdToken();
    await fetch('/.netlify/functions/social-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ recipientUid, type: 'call', text: 'Call status update', callId, callAction }),
    });
  } catch (err) {
    console.warn('Call status push could not be sent:', err);
  }
}
