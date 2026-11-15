import { initializeApp, getApps, getApp } from 'firebase/app';
import { Capacitor } from '@capacitor/core';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Preserves the existing live Trendit Firebase project (trend-it-c7ea4)
// while allowing optional VITE_FIREBASE_* environment overrides.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDn2cYKArmlHgfva7QFOtpOFppemZVdpjk',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'trend-it-c7ea4.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'trend-it-c7ea4',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'trend-it-c7ea4.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '757837469928',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:757837469928:web:8ef7173ec5a465a5db515d',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-83210NQE5W',
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function initializeFirebaseAuth() {
  if (!Capacitor.isNativePlatform()) {
    const webAuth = getAuth(app);
    setPersistence(webAuth, browserLocalPersistence).catch((err) => {
      console.warn('Web auth persistence setup notice:', err);
    });
    return webAuth;
  }

  // IndexedDB persistence is required for the Firebase JS SDK session in
  // Capacitor's Android WebView after native provider UI returns to the app.
  try {
    return initializeAuth(app, { persistence: indexedDBLocalPersistence });
  } catch (error) {
    // Avoid breaking hot reload or duplicate module initialization.
    if ((error as { code?: string })?.code === 'auth/already-initialized') {
      return getAuth(app);
    }
    throw error;
  }
}

export const auth = initializeFirebaseAuth();
export const db = getFirestore(app);
export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function formatFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  return errInfo;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo = formatFirestoreError(error, operationType, path);
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;
export async function verifyFirestoreConnection(): Promise<void> {
  if (connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'posts', '__connection_probe__'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration or network connection.');
    }
  }
}
