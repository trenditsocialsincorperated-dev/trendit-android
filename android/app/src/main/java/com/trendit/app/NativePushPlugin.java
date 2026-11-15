package com.trendit.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.google.firebase.messaging.FirebaseMessaging;
import com.trendit.app.push.IncomingCallService;

@CapacitorPlugin(name = "NativePush", permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) })
public class NativePushPlugin extends Plugin {
    @PluginMethod
    public void checkPermissions(PluginCall call) {
        boolean enabled = androidx.core.app.NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        com.getcapacitor.JSObject result = new com.getcapacitor.JSObject();
        result.put("receive", enabled ? "granted" : "denied");
        call.resolve(result);
    }

    @PluginMethod
    public void register(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationPermissionResult");
            return;
        }
        returnToken(call);
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void notificationPermissionResult(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
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
            com.getcapacitor.JSObject result = new com.getcapacitor.JSObject();
            result.put("token", task.getResult());
            call.resolve(result);
        });
    }

    @PluginMethod
    public void startIncomingCallAlert(PluginCall call) {
        android.content.Intent intent = new android.content.Intent(getContext(), IncomingCallService.class);
        intent.setAction(IncomingCallService.ACTION_START);
        String callerName = call.getString("callerName");
        intent.putExtra("callerName", callerName == null ? "Trendit user" : callerName);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(intent);
        else getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void stopIncomingCallAlert(PluginCall call) {
        IncomingCallService.stop(getContext());
        call.resolve();
    }
}
