package com.ivory37.controllaboral;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

/** One-shot alarms: exact when Android grants access, inexact otherwise. */
public final class ReminderReceiver extends BroadcastReceiver {
    private static final String PREFS = "labor_reminders";
    private static final String CHANNEL = "control_laboral_reminders";

    static void configure(Context context, String raw) throws Exception {
        if (raw == null || raw.length() > 2048) throw new IllegalArgumentException("Reminder configuration too large");
        JSONObject config = new JSONObject(raw);
        for (String key : new String[]{"start", "end"}) {
            int minute = config.getInt(key);
            if (minute < 0 || minute >= 1440) throw new IllegalArgumentException("Invalid reminder time");
        }
        if (!context.getSharedPreferences(PREFS, 0).edit().putString("config", config.toString()).commit()) throw new Exception("Could not save reminders");
        schedule(context);
    }

    static void schedule(Context context) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        if (alarms == null) return;
        try {
            JSONObject config = new JSONObject(context.getSharedPreferences(PREFS, 0).getString("config", "{}"));
            for (int kind = 0; kind < 2; kind++) {
                Intent intent = new Intent(context, ReminderReceiver.class).setAction("com.ivory37.REMINDER").putExtra("kind", kind);
                PendingIntent pending = PendingIntent.getBroadcast(context, 7100 + kind, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                alarms.cancel(pending);
                if (!config.optBoolean("enabled")) continue;
                int minute = config.getInt(kind == 0 ? "start" : "end");
                Calendar next = Calendar.getInstance();
                next.set(Calendar.HOUR_OF_DAY, minute / 60); next.set(Calendar.MINUTE, minute % 60);
                next.set(Calendar.SECOND, 0); next.set(Calendar.MILLISECOND, 0);
                if (next.getTimeInMillis() <= System.currentTimeMillis()) next.add(Calendar.DATE, 1);
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()) {
                    alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pending);
                } else {
                    // Keep reminders useful when the user declines Android's special exact-alarm access.
                    alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pending);
                }
            }
        } catch (Exception ignored) { /* Unconfigured installations have no alarms. */ }
    }

    @Override public void onReceive(Context context, Intent intent) {
        try {
            if ("com.ivory37.REMINDER".equals(intent.getAction())) {
                JSONObject config = new JSONObject(context.getSharedPreferences(PREFS, 0).getString("config", "{}"));
                NotificationManager manager = context.getSystemService(NotificationManager.class);
                boolean permitted = manager != null && manager.areNotificationsEnabled()
                    && (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED);
                String today = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(Calendar.getInstance().getTime());
                boolean sameDay = today.equals(config.optString("date"));
                boolean entered = sameDay && config.optBoolean("entered");
                boolean exited = sameDay && config.optBoolean("exited");
                int kind = intent.getIntExtra("kind", -1);
                if (permitted && config.optBoolean("enabled") && ((kind == 0 && !entered) || (kind == 1 && entered && !exited))) {
                    if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Recordatorios de jornada", NotificationManager.IMPORTANCE_DEFAULT));
                    Intent launch = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    PendingIntent open = PendingIntent.getActivity(context, 7200, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                    Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(context, CHANNEL) : new Notification.Builder(context);
                    manager.notify(7100 + kind, builder.setSmallIcon(android.R.drawable.ic_popup_reminder)
                        .setContentTitle(kind == 0 ? "Recordatorio de entrada" : "Recordatorio de salida")
                        .setContentText("Revisa tu fichaje en Control Laboral.").setContentIntent(open).setAutoCancel(true).build());
                }
            }
        } catch (Exception ignored) { }
        schedule(context);
    }
}
