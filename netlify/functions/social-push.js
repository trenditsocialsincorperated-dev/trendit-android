const { cert, getApp, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'trend-it-c7ea4';

let firebaseApp;

function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable.');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch (_) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
  }

  firebaseApp = getApps().length
    ? getApp()
    : initializeApp({
        credential: cert(serviceAccount),
        projectId: PROJECT_ID,
      });

  return firebaseApp;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST.' });

  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return json(401, { error: 'Sign-in required.' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_) {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const recipientUid = String(body.recipientUid || '').trim();
  const type = String(body.type || '').trim().toLowerCase();
  const text = String(body.text || '').trim();
  const postId = body.postId ? String(body.postId).slice(0, 200) : '';
  const callId = body.callId ? String(body.callId).slice(0, 200) : '';
  const callAction = String(body.callAction || 'ringing').slice(0, 20);

  if (
    !recipientUid ||
    recipientUid.length > 200 ||
    !text ||
    text.length > 500 ||
    !['like', 'follow', 'unfollow', 'post', 'reply', 'comment', 'dm', 'call'].includes(type)
  ) {
    return json(400, { error: 'Invalid notification details.' });
  }

  try {
    const app = getFirebaseApp();
    const decoded = await getAuth(app).verifyIdToken(match[1]);

    if (decoded.uid === recipientUid) {
      return json(200, { sent: false, reason: 'self-notification' });
    }

    const db = getFirestore(app);
    const [senderSnap, recipientSnap] = await Promise.all([
      db.collection('users').doc(decoded.uid).get(),
      db.collection('users').doc(recipientUid).get(),
    ]);

    if (!recipientSnap.exists) {
      return json(404, { error: 'Recipient not found.' });
    }

    const recipient = recipientSnap.data() || {};
    const targets = [
      { token: recipient.fcmToken, field: 'fcmToken', platform: 'android' },
      { token: recipient.webFcmToken, field: 'webFcmToken', platform: 'web' },
    ].filter((target) => typeof target.token === 'string' && target.token.length > 0);
    if (targets.length === 0) {
      return json(200, { sent: false, reason: 'recipient-has-no-fcm-token' });
    }

    const sender = senderSnap.exists ? senderSnap.data() || {} : {};
    const senderName = String(sender.displayName || sender.handle || 'Someone').slice(0, 100);

    const titleByType = {
      like: 'New like on Trendit',
      follow: 'New follower on Trendit',
      unfollow: 'Someone unfollowed you on Trendit',
      post: `New post from ${senderName}`,
      reply: 'New reply on Trendit',
      comment: 'New comment on Trendit',
      dm: `New message from ${senderName}`,
      call: `Incoming call from ${senderName}`,
    };

    const safeText = text.slice(0, 180) || `${senderName} interacted with you.`;

    const messaging = getMessaging(app);
    const results = await Promise.all(targets.map(async ({ token, field, platform }) => {
      const message = {
        token,
        ...(platform === 'web' ? {
          notification: {
            title: titleByType[type] || 'Trendit Notification',
            body: safeText,
          },
        } : {}),
        data: {
          type,
          recipientUid,
          senderUid: decoded.uid,
          senderName,
          postId,
          callId,
          callAction,
          title: titleByType[type] || 'Trendit Notification',
          body: safeText,
          platform,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        ...(platform === 'android' ? {
          android: { priority: 'high' },
        } : {}),
        ...(platform === 'web' ? {
          webpush: {
            headers: { Urgency: 'high' },
            notification: { icon: '/icon-192.png', badge: '/icon-192.png' },
            fcmOptions: { link: '/' },
          },
        } : {}),
      };
      try {
        const messageId = await messaging.send(message);
        return { platform, sent: true, messageId };
      } catch (err) {
        if (err && (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token')) {
          await db.collection('users').doc(recipientUid).update({ [field]: FieldValue.delete() }).catch(() => {});
          return { platform, sent: false, reason: 'stale-token-removed' };
        }
        console.error(`FCM ${platform} send failed:`, err && err.code ? err.code : err);
        return { platform, sent: false, reason: 'send-failed' };
      }
    }));
    const sent = results.some((result) => result.sent);
    return json(200, { sent, results });
  } catch (err) {
    console.error('social-push function error:', err && err.message ? err.message : err);
    if (String((err && err.message) || '').includes('FIREBASE_SERVICE_ACCOUNT_JSON')) {
      return json(200, {
        sent: false,
        reason: 'missing-service-account',
        detail: 'Push service requires FIREBASE_SERVICE_ACCOUNT_JSON on the server.',
      });
    }
    if (
      err &&
      (err.code === 'auth/id-token-expired' ||
        err.code === 'auth/argument-error' ||
        err.code === 'auth/invalid-id-token')
    ) {
      return json(401, { error: 'Session expired. Sign in again.' });
    }
    return json(500, { error: 'Could not process push notification.' });
  }
};
