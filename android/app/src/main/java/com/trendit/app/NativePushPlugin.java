package com.trendit.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.google.firebase.messaging.FirebaseMessaging;
import com.trendit.app.push.IncomingCallService;

@CapacitorPlugin(name = "NativePush", permissions = {
    @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public class NativePushPlugin extends Plugin {
    private static final String EXTRA_NOTIFICATION_DATA = "trendit_notification_data";

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        boolean enabled = androidx.core.app.NotificationManagerCompat
            .from(getContext())
            .areNotificationsEnabled();

        JSObject result = new JSObject();
        result.put("receive", enabled ? "granted" : "denied");
        call.resolve(result);
    }

    @PluginMethod
    public void register(PluginCall call) {
        if (
            Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissionForAlias("notifications", call, "notificationPermissionResult");
            return;
        }
        returnToken(call);
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void notificationPermissionResult(PluginCall call) {
        if (
            Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
        ) {
            call.reject("Notification permission was not granted on Android.");
            return;
        }
        returnToken(call);
    }

    private void returnToken(PluginCall call) {
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful() || task.getResult() == null) {
                call.reject("Could not retrieve Firebase registration token", task.getException());
                return;
            }

            JSObject result = new JSObject();
            result.put("token", task.getResult());
            call.resolve(result);
        });
    }

    /**
     * Capacitor forwards both the launch Intent and subsequent singleTask
     * intents here. Retaining the event is important because the WebView and
     * React listener may not be ready when Android first launches the app.
     */
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent == null) return;

        String payloadJson = intent.getStringExtra(EXTRA_NOTIFICATION_DATA);
        if (payloadJson == null || payloadJson.trim().isEmpty()) return;

        try {
            JSObject payload = new JSObject(payloadJson);
            notifyListeners("notificationAction", payload, true);
        } catch (org.json.JSONException error) {
            android.util.Log.e("TrenditNativePush", "Invalid notification tap payload", error);
        }

        // Prevent this same Activity intent from being processed again.
        intent.removeExtra(EXTRA_NOTIFICATION_DATA);
    }

    @PluginMethod
    public void startIncomingCallAlert(PluginCall call) {
        Intent intent = new Intent(getContext(), IncomingCallService.class);
        intent.setAction(IncomingCallService.ACTION_START);
        String callerName = call.getString("callerName");
        intent.putExtra("callerName", callerName == null ? "Trendit user" : callerName);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void stopIncomingCallAlert(PluginCall call) {
        IncomingCallService.stop(getContext());
        call.resolve();
    }
}
