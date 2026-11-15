# Trendit Android Setup (Capacitor)

## What this project does

This is the Capacitor conversion of the Trendit social web app.
The original HTML/JS is located in `www/index.html`, and the Netlify Agora token function is under `netlify/functions/`.

## Prerequisites

- Node.js 18+
- Android Studio
- Android SDK (API 34+)
- Java JDK 17 or 21

## Build and Sync the Android Project

```bash
# Add Android native container (one-time)
npx cap add android

# Build web assets and sync to native Android
npx cap sync android

# Open project in Android Studio
npx cap open android
```

## Permissions Configured in AndroidManifest.xml

- `android.permission.INTERNET`
- `android.permission.CAMERA` (for video calls & photo uploads)
- `android.permission.RECORD_AUDIO` (for voice & video calls)
- `android.permission.MODIFY_AUDIO_SETTINGS`
- `android.permission.ACCESS_NETWORK_STATE`

## Generating the .apk in Android Studio

1. Open the project in Android Studio: `npx cap open android`
2. Let Gradle sync dependencies.
3. Select **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
4. Your `.apk` will be output to `android/app/build/outputs/apk/debug/app-debug.apk`.
