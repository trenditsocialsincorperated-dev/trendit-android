package com.trendit.app.push;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.trendit.app.R;

final class TrenditNotification {
    static final String CHANNEL = "trendit_general";
    static void show(Context context, String title, String body) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && manager.getNotificationChannel(CHANNEL) == null) {
            manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Trendit notifications", NotificationManager.IMPORTANCE_DEFAULT));
        }
        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher).setContentTitle(title == null ? "Trendit" : title)
            .setContentText(body == null ? "You have a new notification" : body)
            .setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_DEFAULT);
        try {
            NotificationManagerCompat.from(context).notify((int) System.currentTimeMillis(), notification.build());
        } catch (SecurityException ignored) { }

    }
}
