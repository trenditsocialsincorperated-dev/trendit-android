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
  type AuthProvider,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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

type NativeOAuthCredential = {
  accessToken?: string | null;
  idToken?: string | null;
  secret?: string | null;
};

function sanitizeHandle(raw: string, fallbackUid: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, 28);
  return cleaned || `user_${fallbackUid.slice(0, 6)}`;
}

export async function ensureUserProfileDocument(user: User): Promise<UserProfile> {
  const userDocRef = doc(db, 'users', user.uid);
  const existing = await getDoc(userDocRef);

  if (!existing.exists()) {
    const emailPrefix = user.email ? user.email.split('@')[0] : '';
    const derivedHandle = sanitizeHandle(emailPrefix || user.displayName || '', user.uid);
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
    return { uid: user.uid, ...(freshSnap.data() as Omit<UserProfile, 'uid'>) };
  }

  return { uid: existing.id, ...(existing.data() as Omit<UserProfile, 'uid'>) };
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  await ensureUserProfileDocument(cred.user);
  return cred.user;
}

export async function registerWithEmail(payload: RegisterPayload): Promise<User> {
  const handle = sanitizeHandle(payload.handle, 'new');
  const cred = await createUserWithEmailAndPassword(auth, payload.email.trim(), payload.password);

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

async function completeNativeOAuth(
  providerId: 'google' | 'github' | 'twitter',
  startSignIn: () => Promise<{ credential?: NativeOAuthCredential | null }>
): Promise<User> {
  // The native plugin presents the Android provider flow and returns the
  // provider credential. skipNativeAuth=true lets the Firebase JS SDK own
  // the actual app session used by AuthContext, Firestore and Storage.
  const result = await startSignIn();
  const nativeCredential = result.credential;

  if (!nativeCredential) {
    throw new Error(`Trendit could not retrieve the ${providerId} sign-in credential. Please try again.`);
  }

  let credential;
  if (providerId === 'google') {
    if (!nativeCredential.idToken && !nativeCredential.accessToken) {
      throw new Error('Google did not return a usable sign-in token.');
    }
    credential = GoogleAuthProvider.credential(
      nativeCredential.idToken || null,
      nativeCredential.accessToken || undefined
    );
  } else if (providerId === 'github') {
    if (!nativeCredential.accessToken) {
      throw new Error('GitHub did not return an access token.');
    }
    credential = GithubAuthProvider.credential(nativeCredential.accessToken);
  } else {
    if (!nativeCredential.accessToken || !nativeCredential.secret) {
      throw new Error('X did not return the access token and secret required by Firebase.');
    }
    credential = TwitterAuthProvider.credential(
      nativeCredential.accessToken,
      nativeCredential.secret
    );
  }

  const firebaseResult = await signInWithCredential(auth, credential);
  await ensureUserProfileDocument(firebaseResult.user);
  return firebaseResult.user;
}

async function signInWithOAuthProvider(
  provider: AuthProvider
): Promise<User | null> {
  try {
    const cred = await signInWithPopup(auth, provider);
    await ensureUserProfileDocument(cred.user);
    return cred.user;
  } catch (err: any) {
    if (err?.code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

export async function loginWithGoogle(): Promise<User | null> {
  if (Capacitor.isNativePlatform()) {
    return completeNativeOAuth('google', () =>
      FirebaseAuthentication.signInWithGoogle({ useCredentialManager: true })
    );
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithOAuthProvider(provider);
}

export async function loginWithGithub(): Promise<User | null> {
  if (Capacitor.isNativePlatform()) {
    return completeNativeOAuth('github', () =>
      FirebaseAuthentication.signInWithGithub({ scopes: ['read:user', 'user:email'] })
    );
  }

  return signInWithOAuthProvider(new GithubAuthProvider());
}

export async function loginWithTwitter(): Promise<User | null> {
  if (Capacitor.isNativePlatform()) {
    return completeNativeOAuth('twitter', () =>
      FirebaseAuthentication.signInWithTwitter()
    );
  }

  return signInWithOAuthProvider(new TwitterAuthProvider());
}

export async function checkOAuthRedirectResult(): Promise<void> {
  if (Capacitor.isNativePlatform()) return;

  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      await ensureUserProfileDocument(result.user);
    }
  } catch (err) {
    console.warn('OAuth redirect check error:', err);
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function logoutUser(): Promise<void> {
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
