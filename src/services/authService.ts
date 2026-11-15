
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  GoogleAuthProvider,
  GithubAuthProvider,
  TwitterAuthProvider,
  signOut as firebaseSignOut,
  type User,
  type AuthCredential,
} from 'firebase/auth';

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';

import { auth, db } from './firebase';
import type { UserProfile } from '@/types';

export interface RegisterPayload {
  fullName: string;
  handle: string;
  age: number;
  gender: string;
  email: string;
  password: string;
}

function sanitizeHandle(raw: string, fallbackUid: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, 28);

  return cleaned || `user_${fallbackUid.slice(0, 6)}`;
}

export async function ensureUserProfileDocument(
  user: User
): Promise<UserProfile> {
  const userDocRef = doc(db, 'users', user.uid);
  const existing = await getDoc(userDocRef);

  if (!existing.exists()) {
    const emailPrefix = user.email ? user.email.split('@')[0] : '';

    const derivedHandle = sanitizeHandle(
      emailPrefix || user.displayName || '',
      user.uid
    );

    const initialProfile = {
      uid: user.uid,
      displayName: user.displayName || 'Trendit Member',
      handle: derivedHandle,
      age: 18,
      gender: 'Prefer not to say',
      bio: 'Hey there! I am using Trendit.',
      email: user.email || '',
      photoURL: user.photoURL || null,
      createdAt: serverTimestamp(),
    };

    await setDoc(userDocRef, initialProfile);

    const freshSnap = await getDoc(userDocRef);

    return {
      uid: user.uid,
      ...(freshSnap.data() as Omit<UserProfile, 'uid'>)
    };
  }

  return {
    uid: existing.id,
    ...(existing.data() as Omit<UserProfile, 'uid'>)
  };
}

/**
 * Exchanges a credential returned by the native authentication plugin
 * for a Firebase JavaScript SDK session.
 *
 * This is important because Trendit uses the Firebase JS SDK for
 * Firestore, Storage, and AuthContext.
 */
async function finishNativeCredentialSignIn(
  credential: AuthCredential
): Promise<User> {
  const result = await signInWithCredential(auth, credential);

  await ensureUserProfileDocument(result.user);

  return result.user;
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<User> {
  const cred = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );

  await ensureUserProfileDocument(cred.user);

  return cred.user;
}

export async function registerWithEmail(
  payload: RegisterPayload
): Promise<User> {
  const handle = sanitizeHandle(payload.handle, 'new');

  const cred = await createUserWithEmailAndPassword(
    auth,
    payload.email.trim(),
    payload.password
  );

  await setDoc(doc(db, 'users', cred.user.uid), {
    uid: cred.user.uid,
    displayName: payload.fullName.trim(),
    handle,
    age: Number(payload.age) || 18,
    gender: payload.gender || 'Prefer not to say',
    bio: 'New Trendit member!',
    email: payload.email.trim(),
    photoURL: null,
    createdAt: serverTimestamp(),
  });

  return cred.user;
}

/**
 * Existing browser OAuth flow.
 * Keep this for the web version of Trendit.
 */
async function signInWithOAuthProvider(
  provider:
    | GoogleAuthProvider
    | GithubAuthProvider
    | TwitterAuthProvider
): Promise<User | null> {
  try {
    const cred = await signInWithPopup(auth, provider);

    await ensureUserProfileDocument(cred.user);

    return cred.user;
  } catch (err: any) {
    // Preserve the existing redirect fallback for browsers
    // where popups are blocked.
    if (err?.code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider);
      return null;
    }

    throw err;
  }
}

/**
 * Google sign-in.
 * Android uses native Google Credential Manager.
 * Web keeps the existing Firebase popup flow.
 */
export async function loginWithGoogle(): Promise<User | null> {
  if (Capacitor.isNativePlatform()) {
    const nativeResult = await FirebaseAuthentication.signInWithGoogle({
      skipNativeAuth: true,
      useCredentialManager: true
    });

    const idToken = nativeResult.credential?.idToken;

    if (!idToken) {
      throw new Error(
        'Google sign-in did not return an ID token. Check your Android SHA-1 and Firebase Google provider configuration.'
      );
    }

    const credential = GoogleAuthProvider.credential(idToken);

    return finishNativeCredentialSignIn(credential);
  }

  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: 'select_account'
  });

  return signInWithOAuthProvider(provider);
}

/**
 * GitHub sign-in.
 * Android uses the native Firebase Authentication plugin.
 * Web keeps the existing Firebase popup flow.
 */
export async function loginWithGithub(): Promise<User | null> {
  if (Capacitor.isNativePlatform()) {
    const nativeResult = await FirebaseAuthentication.signInWithGithub({
      skipNativeAuth: true,
      scopes: ['read:user', 'user:email']
    });

    const accessToken = nativeResult.credential?.accessToken;

    if (!accessToken) {
      throw new Error(
        'GitHub sign-in did not return an access token. Check that GitHub is enabled in Firebase Authentication.'
      );
    }

    const credential = GithubAuthProvider.credential(accessToken);

    return finishNativeCredentialSignIn(credential);
  }

  const provider = new GithubAuthProvider();

  return signInWithOAuthProvider(provider);
}

/**
 * X / Twitter sign-in.
 * Uses the native provider flow on Android.
 * Web keeps the existing Firebase popup flow.
 */
export async function loginWithTwitter(): Promise<User | null> {
  if (Capacitor.isNativePlatform()) {
    const nativeResult = await FirebaseAuthentication.signInWithTwitter({
      skipNativeAuth: false
    });

    const accessToken = nativeResult.credential?.accessToken;
    const secret = nativeResult.credential?.secret;

    if (!accessToken || !secret) {
      throw new Error(
        'X/Twitter sign-in did not return the required access token and secret. Check your Twitter provider configuration in Firebase.'
      );
    }

    const credential = TwitterAuthProvider.credential(
      accessToken,
      secret
    );

    return finishNativeCredentialSignIn(credential);
  }

  const provider = new TwitterAuthProvider();

  return signInWithOAuthProvider(provider);
}

/**
 * Redirect results are only relevant to the browser OAuth flow.
 * Native Android sign-in returns directly from the plugin call.
 */
export async function checkOAuthRedirectResult(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    return;
  }

  try {
    const result = await getRedirectResult(auth);

    if (result?.user) {
      await ensureUserProfileDocument(result.user);
    }
  } catch (err) {
    console.warn('OAuth redirect check error:', err);
  }
}

export async function sendPasswordReset(
  email: string
): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function logoutUser(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await FirebaseAuthentication.signOut();
    } catch (error) {
      // Continue signing out the JavaScript Firebase session
      // even if the native sign-out call reports an error.
      console.warn('Native Firebase sign-out notice:', error);
    }
  }

  await firebaseSignOut(auth);
}

export function getFriendlyAuthError(err: any): string {
  const code = err?.code || '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please double-check your credentials.';

    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';

    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';

    case 'auth/popup-closed-by-user':
      return 'Sign-in window was closed before completing authentication.';

    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in provider.';

    case 'auth/unauthorized-domain':
      return 'This preview domain must be added to Firebase Console -> Authentication -> Settings -> Authorized domains for popup OAuth, or sign in with Email & Password.';

    default:
      return err?.message || 'Authentication failed. Please try again.';
  }
}
