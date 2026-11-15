# Trendit Android native social sign-in patch

This patch targets the Android app only. Browser sign-in code paths are retained, and the existing
FCM/push notification implementation is not changed.

## Included changes
- Adds `@capacitor-firebase/authentication` 8.x (Capacitor 8 compatible).
- Uses Android-native Google Credential Manager, GitHub and X/Twitter provider flows.
- Converts returned provider credentials into a Firebase JavaScript SDK session so the existing
  AuthContext, Firestore profile and app services continue using `auth.currentUser`.
- Uses IndexedDB persistence for Firebase Auth in the native WebView; keeps browser persistence on web.
- Configures the plugin providers and Android Credential Manager dependencies.

## Apply
Copy the files in this archive over the matching repository paths:
- `package.json`
- `capacitor.config.ts`
- `src/services/firebase.ts`
- `src/services/authService.ts`
- `android/variables.gradle`

Then run:
```bash
bun install
npx cap sync android
npm run build
```
`bun install` must be run so `bun.lock` is regenerated; this archive intentionally does not replace
the existing lockfile with a hand-edited/incomplete dependency graph.

## Firebase Console checks before testing
1. In Firebase Console > Authentication > Sign-in method, ensure Google, GitHub and Twitter are enabled.
2. In Firebase Console > Project settings > Your apps > Android, confirm package `com.trendit.app`.
3. Confirm the SHA-1 used to sign the APK is registered for the Android app. The checked-in
   `google-services.json` currently contains an Android OAuth client with certificate hash
   `f8513d927fddd44245b49e8431a3ae930f1276d8`; if the APK signing certificate differs, add its
   SHA-1 and download a fresh `google-services.json`.
4. Confirm the GitHub OAuth app and X developer app credentials are configured in Firebase's
   provider settings, including the Firebase callback URL shown there.

## Important test notes
- Test Google first, then GitHub, then X.
- These changes are not a claim that provider-console configuration has been verified.
- A successful provider UI is not enough: after each login, confirm the app returns to Trendit,
  AuthContext receives a Firebase user, and the matching `users/{uid}` document exists.
- Never share a full OAuth callback URL or authorization code in screenshots/logs.
