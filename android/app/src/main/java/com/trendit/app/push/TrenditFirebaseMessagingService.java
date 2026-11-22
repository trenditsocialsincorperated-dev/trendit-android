package com.trendit.app.push;

import android.content.Intent;
import android.os.Build;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class TrenditFirebaseMessagingService extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(RemoteMessage message) {
        String type = message.getData().get("type");

        if ("call".equals(type)) {
            String callAction = message.getData().get("callAction");
            if (
                "ended".equals(callAction) ||
                "declined".equals(callAction) ||
                "accepted".equals(callAction)
            ) {
                IncomingCallService.stop(this);
                return;
            }

            String caller = message.getData().get("senderName");
            String callId = message.getData().get("callId");
            Intent intent = new Intent(this, IncomingCallService.class);
            intent.setAction(IncomingCallService.ACTION_START);
            intent.putExtra("callerName", caller == null ? "Trendit user" : caller);
            intent.putExtra("callId", callId == null ? "" : callId);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent);
            } else {
                startService(intent);
            }
            return;
        }

        // Keep the complete FCM data payload. The notification's tap action
        // needs type, senderUid and postId to open the correct Trendit screen.
        TrenditNotification.show(this, message.getData());
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
    }
}
