# Trendit Android setup

## What this project does

This is the first Capacitor conversion of the existing Trendit web app. The original HTML is preserved in `www/index.html`, while the existing Netlify Agora token function remains under `netlify/functions/`.

## Prerequisites

- Node.js 18+
- Android Studio
- Android SDK / platform tools
- A JDK supported by the installed Capacitor/Android Gradle tooling

## Create the Android project

From this folder:

```bash
npm install
npx cap add android
npx cap sync android
npx cap open android
```

## Current Android/Firebase fixes

- Email/password authentication continues to use the Firebase Web SDK.
- Google, GitHub, and Twitter authentication automatically switch from `signInWithPopup()` on the website to Firebase `signInWithRedirect()` on the Capacitor Android build. Firebase documents redirect sign-in as the preferred flow on mobile devices.
- The Android build uses the existing Firebase project `trend-it-c7ea4`; it does not create a second Firebase project.
- The Agora token request now supports a configurable absolute Netlify function URL because `/.netlify/functions/...` would otherwise resolve to the Android WebView's `https://localhost` origin.

## Firebase Console checklist

1. Keep the existing Firebase Authentication providers enabled (Email/Password, Google, GitHub, Twitter as applicable).
2. In Firebase Authentication > Settings > Authorized domains, make sure the domains used by the web app and Firebase OAuth flow are authorized.
3. For Google/GitHub/Twitter OAuth, keep the Firebase handler URL authorized where the provider requires it: `https://trend-it-c7ea4.firebaseapp.com/__/auth/handler`.
4. Register the Android app in the existing Firebase project with package ID `com.trendit.app`. Download the resulting `google-services.json` for the native Android project when the Android project is generated.
5. For Google Sign-In, add the Android SHA-1/SHA-256 fingerprints from the signing certificate used to build the APK/AAB.

## Build

From this folder:

```bash
npm install
npx cap add android
npx cap sync android
npx cap open android
```

The package now includes `@capacitor/android` so the Android platform can be generated.

## Agora

Before an Android release that uses calls, set `window.TRENDIt_AGORA_TOKEN_ENDPOINT` in `www/index.html` to the public URL of the existing Netlify function, for example:

```js
window.TRENDIt_AGORA_TOKEN_ENDPOINT =
  'https://YOUR-SITE.netlify.app/.netlify/functions/agora-token';
```

Do not put `AGORA_APP_CERTIFICATE` in the Android app. The certificate must remain a Netlify environment variable on the server.

The website remains deployable independently from `www/`/the existing Netlify setup.
