package com.trendit.app.push;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import com.trendit.app.MainActivity;
import com.trendit.app.R;

public class IncomingCallService extends Service {
    public static final String ACTION_START = "com.trendit.app.CALL_ALERT_START";
    public static final String ACTION_STOP = "com.trendit.app.CALL_ALERT_STOP";
    private static final String CHANNEL = "trendit_incoming_calls";
    private static final int NOTIFICATION_ID = 7401;
    private Ringtone ringtone;

    public static void stop(Context context) {
        Intent intent = new Intent(context, IncomingCallService.class);
        intent.setAction(ACTION_STOP);
        context.startService(intent);
    }

    @Override public void onCreate() { super.onCreate(); createChannel(); }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) { stopAlert(); return START_NOT_STICKY; }
        String caller = intent == null ? "Trendit user" : intent.getStringExtra("callerName");
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent fullScreen = PendingIntent.getActivity(this, 7402, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher).setContentTitle("Incoming Trendit call")
            .setContentText((caller == null ? "Someone" : caller) + " is calling you")
            .setCategory(NotificationCompat.CATEGORY_CALL).setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC).setOngoing(true)
            .setFullScreenIntent(fullScreen, true).setContentIntent(fullScreen)
            .setAutoCancel(false).build();
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        else startForeground(NOTIFICATION_ID, notification);
        startRingtone();
        return START_STICKY;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Incoming calls", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Incoming Trendit audio and video calls");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.setSound(null, null);
            manager.createNotificationChannel(channel);
        }
    }

    private void startRingtone() {
        try {
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            ringtone = RingtoneManager.getRingtone(this, uri);
            if (ringtone != null) {
                if (Build.VERSION.SDK_INT >= 28) ringtone.setLooping(true);
                ringtone.play();
            }
        } catch (Exception ignored) { }
    }

    private void stopAlert() {
        if (ringtone != null) { try { ringtone.stop(); } catch (Exception ignored) { } ringtone = null; }
        stopForeground(true);
        stopSelf();
    }

    @Override public void onDestroy() { stopAlert(); super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }
}
