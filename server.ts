import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import agoraTokenPkg from 'agora-token';
import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

dotenv.config();

const { RtcTokenBuilder, RtcRole } = agoraTokenPkg;

const app = express();
const PORT = 3000;

const AGORA_APP_ID = process.env.AGORA_APP_ID || '02fde73deba244599248162cca0c8baf';
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || '';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'trend-it-c7ea4';
const TOKEN_EXPIRATION_SECONDS = 3600;

let firebaseAdminApp: App | null = null;

function getFirebaseAdmin(): App {
  if (firebaseAdminApp) return firebaseAdminApp;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable.');
  }

  let serviceAccount: ServiceAccount;
  try {
    serviceAccount = JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
  }

  firebaseAdminApp = getApps().length
    ? getApp()
    : initializeApp({
        credential: cert(serviceAccount),
        projectId: FIREBASE_PROJECT_ID,
      });

  return firebaseAdminApp;
}

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// CORS headers for Capacitor Android WebView & Web clients
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Non-secret backend capability status endpoint for honest push/call diagnostics
app.get(['/api/backend-status', '/.netlify/functions/backend-status'], (_req, res) => {
  let fcmAdminConfigured = false;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      fcmAdminConfigured = true;
    } catch {
      fcmAdminConfigured = false;
    }
  }

  return res.json({
    projectId: FIREBASE_PROJECT_ID,
    fcmAdminConfigured,
    agoraAppIdConfigured: Boolean(AGORA_APP_ID),
    agoraCertificateConfigured: Boolean(AGORA_APP_CERTIFICATE),
  });
});

// Agora RTC Token Endpoint (mirrors netlify/functions/agora-token.js)
app.post(['/api/agora-token', '/.netlify/functions/agora-token'], (req, res) => {
  if (!AGORA_APP_ID) {
    return res.status(500).json({ error: 'Agora token server is not configured.' });
  }

  const channel = String(req.body?.channelName || req.body?.channel || '').trim();
  const uidNumber = Number(req.body?.uid);

  if (!channel || channel.length > 64) {
    return res
      .status(400)
      .json({ error: 'channel must be a non-empty string of 64 characters or fewer.' });
  }

  if (!Number.isInteger(uidNumber) || uidNumber < 1 || uidNumber > 2147483647) {
    return res.status(400).json({ error: 'uid must be a positive 32-bit integer.' });
  }

  try {
    let token: string | null = null;
    if (AGORA_APP_CERTIFICATE) {
      token = RtcTokenBuilder.buildTokenWithUid(
        AGORA_APP_ID,
        AGORA_APP_CERTIFICATE,
        channel,
        uidNumber,
        RtcRole.PUBLISHER,
        TOKEN_EXPIRATION_SECONDS,
        TOKEN_EXPIRATION_SECONDS
      );
    }

    return res.json({
      token,
      appId: AGORA_APP_ID,
      certificateConfigured: Boolean(AGORA_APP_CERTIFICATE),
      uid: uidNumber,
      channel,
      expiresIn: TOKEN_EXPIRATION_SECONDS,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Agora token generation failed:', message);
    return res.status(500).json({
      error: 'Failed to generate Agora token.',
      details: message,
    });
  }
});

// Social Push Notification Endpoint (mirrors netlify/functions/social-push.js)
app.post(['/api/social-push', '/.netlify/functions/social-push'], async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: 'Sign-in required.' });
  }

  const recipientUid = String(req.body?.recipientUid || '').trim();
  const type = String(req.body?.type || '').trim().toLowerCase();
  const text = String(req.body?.text || '').trim();
  const postId = req.body?.postId ? String(req.body.postId).slice(0, 200) : '';
  const callId = req.body?.callId ? String(req.body.callId).slice(0, 200) : '';
  const callAction = String(req.body?.callAction || 'ringing').slice(0, 20);

  if (
    !recipientUid ||
    recipientUid.length > 200 ||
    !text ||
    text.length > 500 ||
    !['like', 'follow', 'reply', 'comment', 'dm', 'call'].includes(type)
  ) {
    return res.status(400).json({ error: 'Invalid notification details.' });
  }

  try {
    const adminApp = getFirebaseAdmin();
    const decoded = await getAuth(adminApp).verifyIdToken(match[1]);

    if (decoded.uid === recipientUid) {
      return res.json({ sent: false, reason: 'self-notification' });
    }

    const firestore = getFirestore(adminApp);
    const [senderSnap, recipientSnap] = await Promise.all([
      firestore.collection('users').doc(decoded.uid).get(),
      firestore.collection('users').doc(recipientUid).get(),
    ]);

    if (!recipientSnap.exists) {
      return res.status(404).json({ error: 'Recipient not found.' });
    }

    const recipient = recipientSnap.data() || {};
    const targets = [
      { token: recipient.fcmToken, field: 'fcmToken', platform: 'android' },
      { token: recipient.webFcmToken, field: 'webFcmToken', platform: 'web' },
    ].filter((target) => typeof target.token === 'string' && target.token.length > 0);
    if (targets.length === 0) {
      return res.json({ sent: false, reason: 'recipient-has-no-fcm-token' });
    }

    const sender = senderSnap.exists ? senderSnap.data() || {} : {};
    const senderName = String(sender.displayName || sender.handle || 'Someone').slice(0, 100);

    const titleByType: Record<string, string> = {
      like: 'New like on Trendit',
      follow: 'New follower on Trendit',
      reply: 'New reply on Trendit',
      comment: 'New comment on Trendit',
      dm: `New message from ${senderName}`,
      call: `Incoming call from ${senderName}`,
    };

    const safeText = text.slice(0, 180) || `${senderName} interacted with you.`;

    const messaging = getMessaging(adminApp);
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
          android: { priority: 'high' as const },
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
      } catch (err: any) {
        if (
          err?.code === 'messaging/registration-token-not-registered' ||
          err?.code === 'messaging/invalid-registration-token'
        ) {
          await firestore.collection('users').doc(recipientUid)
            .update({ [field]: FieldValue.delete() }).catch(() => {});
          return { platform, sent: false, reason: 'stale-token-removed' };
        }
        console.error(`FCM ${platform} send failed:`, err?.code || err);
        return { platform, sent: false, reason: 'send-failed' };
      }
    }));
    return res.json({ sent: results.some((result) => result.sent), results });
  } catch (err: any) {
    const message = err?.message || String(err);
    if (message.includes('FIREBASE_SERVICE_ACCOUNT_JSON')) {
      return res.json({
        sent: false,
        reason: 'missing-service-account',
        detail: 'FIREBASE_SERVICE_ACCOUNT_JSON is not configured on the server.',
      });
    }
    if (
      err?.code === 'auth/id-token-expired' ||
      err?.code === 'auth/argument-error' ||
      err?.code === 'auth/invalid-id-token'
    ) {
      return res.status(401).json({ error: 'Session expired. Sign in again.' });
    }
    console.error('social-push error:', message);
    return res.status(500).json({ error: 'Could not process push notification.' });
  }
});

async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Trendit server running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap();
