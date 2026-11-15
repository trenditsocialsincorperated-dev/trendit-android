import { Capacitor } from '@capacitor/core';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { doc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { app, db } from './firebase';
import type { PushDiagnosticState, UserProfile } from '@/types';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

export async function fetchBackendCapabilities(): Promise<{
  fcmAdminConfigured: boolean | null;
  agoraCertificateConfigured: boolean | null;
}> {
  try {
    const res = await fetch('/api/backend-status');
    if (!res.ok) return { fcmAdminConfigured: null, agoraCertificateConfigured: null };
    const data = await res.json();
    return {
      fcmAdminConfigured: Boolean(data.fcmAdminConfigured),
      agoraCertificateConfigured: Boolean(data.agoraCertificateConfigured),
    };
  } catch {
    return { fcmAdminConfigured: null, agoraCertificateConfigured: null };
  }
}

export async function getPushDiagnostics(
  userProfile: UserProfile | null
): Promise<PushDiagnosticState> {
  const isNative = Capacitor.isNativePlatform();
  const backend = await fetchBackendCapabilities();
  // Keep the Android and browser registrations independent.
  const hasStoredToken = isNative
    ? Boolean(userProfile?.fcmToken)
    : Boolean(userProfile?.webFcmToken);
  const vapidConfigured = Boolean(VAPID_KEY);
  const missingComponents: string[] = [];

  let permission: PushDiagnosticState['permission'] = 'unsupported';
  if (isNative) {
    const nativePlugin = (window as any).Capacitor?.Plugins?.NativePush;
    if (nativePlugin) {
      try {
        const perm = await nativePlugin.checkPermissions();
        permission = perm?.receive === 'granted' ? 'granted' : 'denied';
      } catch {
        permission = 'default';
      }
    } else {
      missingComponents.push(
        'NativePush bridge and android/app/google-services.json are required for native Android FCM token registration.'
      );
    }
  } else if (typeof window !== 'undefined' && 'Notification' in window) {
    permission = Notification.permission;
    if (!vapidConfigured) {
      missingComponents.push(
        'VITE_FIREBASE_VAPID_KEY is not set in environment variables (required by Firebase Web Messaging to mint browser FCM tokens).'
      );
    }
  } else {
    missingComponents.push('This browser environment does not support the Web Push Notification API.');
  }

  if (backend.fcmAdminConfigured === false) {
    missingComponents.push(
      'FIREBASE_SERVICE_ACCOUNT_JSON is not configured on the backend / Netlify environment (required by social-push function to dispatch FCM HTTP v1 pushes).'
    );
  }

  let statusSummary = 'In-app real-time notifications are active via Firestore.';
  if (hasStoredToken && backend.fcmAdminConfigured) {
    statusSummary = `${isNative ? 'Android' : 'Browser'} FCM push notifications and real-time in-app notifications are fully active.`;
  } else if (hasStoredToken && backend.fcmAdminConfigured === false) {
    statusSummary = `${isNative ? 'Android' : 'Browser'} FCM token is saved on your profile, awaiting backend FIREBASE_SERVICE_ACCOUNT_JSON to send background pushes.`;
  } else if (missingComponents.length > 0) {
    statusSummary = 'In-app notifications work in real time. Background device push requires additional credentials.';
  }

  return {
    platform: isNative ? 'android-capacitor' : 'web',
    permission,
    hasStoredToken,
    vapidConfigured,
    fcmAdminConfigured: backend.fcmAdminConfigured,
    agoraCertificateConfigured: backend.agoraCertificateConfigured,
    statusSummary,
    missingComponents,
  };
}

/**
 * Registers Android tokens in fcmToken and browser tokens in webFcmToken.
 * The two fields are deliberately separate so a browser login cannot overwrite
 * the native Android registration (and vice versa).
 */
export async function enableDevicePushNotifications(uid: string): Promise<{
  success: boolean;
  message: string;
}> {
  if (!uid) return { success: false, message: 'You must be signed in first.' };

  // 1. Native Android Capacitor flow — preserve the existing fcmToken field.
  if (Capacitor.isNativePlatform()) {
    const pushPlugin = (window as any).Capacitor?.Plugins?.NativePush;
    if (!pushPlugin) {
      return {
        success: false,
        message:
          'Native Android push bridge or google-services.json is missing from this build. Real-time in-app notifications remain active.',
      };
    }

    try {
      const registration = await pushPlugin.register();
      const fcmToken = String(registration?.token || '');
      if (!fcmToken) throw new Error('Firebase did not return an Android registration token.');

      await updateDoc(doc(db, 'users', uid), {
        fcmToken,
        fcmPlatform: 'android',
        fcmUpdatedAt: serverTimestamp(),
      });

      return { success: true, message: 'Android push notifications registered on your Trendit profile.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Could not register Android push token.' };
    }
  }

  // 2. Web / PWA Browser flow — save only to webFcmToken.
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { success: false, message: 'Browser notifications are not supported in this environment.' };
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    return {
      success: false,
      message: 'Firebase Cloud Messaging is not supported in this browser or embedded iframe.',
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { success: false, message: 'Notification permission was declined in the browser.' };
  }

  if (!VAPID_KEY) {
    return {
      success: false,
      message:
        'Browser notification permission granted, but VITE_FIREBASE_VAPID_KEY is not configured yet to mint an FCM Web Push token.',
    };
  }

  try {
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (!token) {
      return { success: false, message: 'Firebase did not return a Web Push token.' };
    }

    await updateDoc(doc(db, 'users', uid), {
      webFcmToken: token,
      webFcmPlatform: 'web',
      webFcmTokenUpdatedAt: serverTimestamp(),
    });

    return { success: true, message: 'Chrome/browser push token registered separately on your Trendit profile.' };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Could not retrieve FCM Web Push token.',
    };
  }
}

/** Remove only the token belonging to the current runtime platform. */
export async function disableDevicePushNotifications(uid: string): Promise<void> {
  if (!uid) return;
  if (Capacitor.isNativePlatform()) {
    await updateDoc(doc(db, 'users', uid), {
      fcmToken: deleteField(),
      fcmPlatform: deleteField(),
      fcmUpdatedAt: deleteField(),
    });
  } else {
    await updateDoc(doc(db, 'users', uid), {
      webFcmToken: deleteField(),
      webFcmPlatform: deleteField(),
      webFcmTokenUpdatedAt: deleteField(),
    });
  }
}
