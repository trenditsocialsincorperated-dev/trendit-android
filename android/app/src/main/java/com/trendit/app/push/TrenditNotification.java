package com.trendit.app.push;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.trendit.app.MainActivity;
import com.trendit.app.R;
import java.util.Map;
import org.json.JSONObject;

final class TrenditNotification {
    static final String CHANNEL = "trendit_general";
    private static final String EXTRA_NOTIFICATION_DATA = "trendit_notification_data";
    private static final String ACTION_OPEN_NOTIFICATION = "com.trendit.app.OPEN_NOTIFICATION";

    private TrenditNotification() {}

    static void show(Context context, Map<String, String> data) {
        createChannel(context);

        String title = data.get("title");
        String body = data.get("body");

        int notificationId = (int) (System.currentTimeMillis() & 0x7fffffff);

        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setAction(ACTION_OPEN_NOTIFICATION);
        openIntent.addFlags(
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP |
            Intent.FLAG_ACTIVITY_NEW_TASK
        );

        // Include the complete data map so the app can route every notification
        // using the same destination rules as its in-app notification list.
        openIntent.putExtra(EXTRA_NOTIFICATION_DATA, new JSONObject(data).toString());

        PendingIntent contentIntent = PendingIntent.getActivity(
            context,
            notificationId,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title == null || title.isEmpty() ? "Trendit" : title)
            .setContentText(body == null || body.isEmpty() ? "You have a new notification" : body)
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_SOCIAL);

        try {
            NotificationManagerCompat.from(context).notify(notificationId, notification.build());
        } catch (SecurityException error) {
            android.util.Log.w("TrenditNotification", "Notification permission is not granted", error);
        }
    }

    private static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager =
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        if (manager != null && manager.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL,
                "Trendit notifications",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Likes, replies, follows, messages and new posts");
            manager.createNotificationChannel(channel);
        }
    }
}
