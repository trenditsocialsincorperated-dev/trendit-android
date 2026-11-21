TRENDit notification source update

This ZIP contains complete replacement source files fetched from the repository's main branch and updated for:
- Unfollow notifications
- New-post notifications to existing followers
- Backend acceptance and titles for the new `unfollow` and `post` notification types
- Awaiting and logging the social-push backend response so DM delivery failures become visible in app logs

INSTALLATION
1. Upload this ZIP to the root of trendit-android.
2. Run the existing GitHub Actions workflow: Extract Trendit Project.
3. The workflow extracts these files into their matching repository paths and commits them.
4. Check the extraction workflow result and then run your normal Android build/deploy workflow.

IMPORTANT
- This ZIP deliberately contains NO .github/workflows files. It will not ask the GitHub App to create or update a workflow.
- The existing extraction workflow is expected to extract the ZIP contents at repository root.
- DM push delivery is not claimed as fixed by this update. The notification service now waits for the backend response and logs the response or failure, which will help diagnose it.
- This update does not change Android native call handling, notification channels, or background-call behavior.
- New-post notifications are sent to the UIDs in users/{authorUid}/followers. Firestore security rules must permit the signed-in author to read that subcollection.
