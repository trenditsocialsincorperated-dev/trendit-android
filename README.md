<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8227022b-03f3-4d1a-b8b0-29c20a2fcf81

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


### Push token storage

Trendit stores native Android FCM registrations in `users/{uid}.fcmToken` and browser/PWA registrations in `users/{uid}.webFcmToken`. The social-push backend sends to both fields independently and removes only a token field that FCM reports as invalid. Do not merge these fields or clear one platform when disabling the other.
