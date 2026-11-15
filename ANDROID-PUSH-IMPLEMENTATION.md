# Trendit Android push and incoming-call alert

This update adds Firebase Android configuration for project `trend-it-c7ea4`, a small Capacitor `NativePush` bridge, a Firebase Messaging service, and a foreground incoming-call alert service. Android registration is stored in `users/{uid}.fcmToken`; Chrome registration remains in `users/{uid}.webFcmToken`.

## Build

1. Install dependencies with `bun install --frozen-lockfile` (or regenerate `bun.lock` if your Bun version reports the lockfile needs updating).
2. Run `bun run build:android` and open the `android` project in Android Studio.
3. Build and install the APK on a physical Android device.
4. Open Trendit, sign in, and enable device push notifications so the Android FCM token is saved.
5. Test with a second account: call the Android account while Trendit is backgrounded.

## Important Android behaviour

- Incoming call pushes are high-priority data messages so the native messaging service can start the foreground call-alert service.
- The service uses the device's default ringtone URI and requests looping on Android 9/API 28 and newer.
- The full-screen notification may be restricted by Android 14+ full-screen-intent policy or device vendor battery settings. Users may need to allow full-screen notifications for Trendit.
- The alert is stopped when the app's call flow invokes `NativePush.stopIncomingCallAlert()` (answer, decline, or observed call end). A remote hang-up while the app process is force-stopped cannot be observed until the device receives a corresponding cancellation event; the current backend sends the ringing event only.
- Do not treat a successful web build as proof of Android background delivery. Verify with a real installed APK and Firebase service-account credentials configured on the backend.

## Firebase config

`android/app/google-services.json` is the client configuration supplied for package `com.trendit.app`. Never put Firebase Admin service-account credentials in this file or in the repository.
