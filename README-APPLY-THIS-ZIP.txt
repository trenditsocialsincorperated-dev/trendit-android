TRENDIt ANDROID PUSH-NOTIFICATION TAP FIX
=========================================

This ZIP contains COMPLETE replacement files, not patch snippets.

WHAT THIS FIX DOES
------------------
- Adds a real Android PendingIntent to each regular Trendit push notification.
- Preserves the FCM data payload (type, senderUid, postId, etc.) when the
  notification is created.
- Passes notification taps through the Capacitor NativePush bridge.
- Retains launch-time notification taps until the React listener is ready.
- Routes taps after Firebase authentication is ready:
    postId present       -> /post/{postId}
    type dm or call      -> /messages/{senderUid}
    other actor events   -> /profile/{senderUid}

FILES TO REPLACE
----------------
1. src/App.tsx
2. android/app/src/main/java/com/trendit/app/NativePushPlugin.java
3. android/app/src/main/java/com/trendit/app/push/TrenditFirebaseMessagingService.java
4. android/app/src/main/java/com/trendit/app/push/TrenditNotification.java

IMPORTANT
---------
- Extract this ZIP at the ROOT of the existing trendit-android repository.
- Allow the four files above to overwrite the existing files.
- Do not place the extracted src/android folders inside another nested folder.
- Do not replace the whole repository with this ZIP; it contains only the
  four complete files that need replacement.
- No Firestore rules, Firebase credentials, google-services.json, package
  dependencies, or server secrets need to be changed for this fix.
- MainActivity.java and AndroidManifest.xml do not need changes: the current
  project already registers NativePush, uses singleTask launch mode, and
  forwards new intents through Capacitor.

AFTER REPLACING
---------------
1. Commit all four replacements to the same branch used by your Android build.
2. Run the existing Android build workflow to create a fresh APK.
3. Install the newly built APK on the Android phone. An old installed APK
   cannot use this fix.
4. Test with the app open, in the background, and fully closed:
   - Like/reply/new post -> correct post
   - Follow/unfollow -> sender profile
   - Direct message -> sender conversation

NOTES
-----
This package was prepared against the repository files inspected on the
current main branch. It has not been built on your device or run through your
GitHub Actions workflow here. Treat the fresh Android build and real-device
tap tests as required verification steps.
