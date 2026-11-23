package com.ivory37.controllaboral;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.json.JSONObject;
import static org.junit.Assert.*;

/** Runs against .audit without starting an Activity or using real user data. */
public class ReminderTest {
    @Test public void alarmDeliversReminderWithoutStartingActivity() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue(context.getPackageName().endsWith(".audit"));
        if (Build.VERSION.SDK_INT >= 33) {
            ParcelFileDescriptor command = InstrumentationRegistry.getInstrumentation().getUiAutomation()
                .executeShellCommand("pm grant " + context.getPackageName() + " " + Manifest.permission.POST_NOTIFICATIONS);
            try (java.io.FileInputStream stream = new java.io.FileInputStream(command.getFileDescriptor())) { while (stream.read() != -1) {} }
            command.close();
        }
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        JSONObject config = new JSONObject().put("enabled", true).put("start", 480).put("end", 960)
            .put("date", "").put("entered", false).put("exited", false);
        android.app.AlarmManager alarms = context.getSystemService(android.app.AlarmManager.class);
        android.app.PendingIntent pending = android.app.PendingIntent.getBroadcast(context, 7199,
            new Intent(context, ReminderReceiver.class).setAction("com.ivory37.REMINDER").putExtra("kind", 0),
            android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
        try {
            ReminderReceiver.configure(context, config.toString()); manager.cancelAll();
            alarms.setAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 1000, pending);
            boolean delivered = false;
            for (int attempt = 0; attempt < 60 && !delivered; attempt++) {
                for (android.service.notification.StatusBarNotification item : manager.getActiveNotifications()) if (item.getId() == 7100) delivered = true;
                if (!delivered) Thread.sleep(1000);
            }
            assertTrue("System alarm must reach receiver and post notification without an Activity", delivered);
        } finally { alarms.cancel(pending); config.put("enabled", false); ReminderReceiver.configure(context, config.toString()); manager.cancelAll(); }
    }
    @Test public void reminderWithoutActivityHonorsEntryExitAndDisabledState() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue(context.getPackageName().endsWith(".audit"));
        if (Build.VERSION.SDK_INT >= 33) {
            ParcelFileDescriptor command = InstrumentationRegistry.getInstrumentation().getUiAutomation()
                .executeShellCommand("pm grant " + context.getPackageName() + " " + Manifest.permission.POST_NOTIFICATIONS);
            try (java.io.FileInputStream stream = new java.io.FileInputStream(command.getFileDescriptor())) { while (stream.read() != -1) {} }
            command.close();
        }
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        assertTrue(manager.areNotificationsEnabled());
        JSONObject config = new JSONObject().put("enabled", true).put("start", 480).put("end", 960)
            .put("date", new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.ROOT).format(new java.util.Date()))
            .put("entered", false).put("exited", false);
        try {
            ReminderReceiver.configure(context, config.toString());
            manager.cancelAll();
            new ReminderReceiver().onReceive(context, new Intent("com.ivory37.REMINDER").putExtra("kind", 0));
            assertTrue(hasNotification(manager, 7100));
            manager.cancelAll();
            config.put("entered", true); ReminderReceiver.configure(context, config.toString());
            new ReminderReceiver().onReceive(context, new Intent("com.ivory37.REMINDER").putExtra("kind", 0));
            assertFalse(hasNotification(manager, 7100));
            new ReminderReceiver().onReceive(context, new Intent("com.ivory37.REMINDER").putExtra("kind", 1));
            assertTrue(hasNotification(manager, 7101));
            manager.cancelAll();
            config.put("exited", true); ReminderReceiver.configure(context, config.toString());
            new ReminderReceiver().onReceive(context, new Intent("com.ivory37.REMINDER").putExtra("kind", 1));
            assertFalse(hasNotification(manager, 7101));
            config.put("entered", false).put("enabled", false); ReminderReceiver.configure(context, config.toString());
            new ReminderReceiver().onReceive(context, new Intent("com.ivory37.REMINDER").putExtra("kind", 0));
            assertFalse(hasNotification(manager, 7100));
        } finally { config.put("enabled", false); ReminderReceiver.configure(context, config.toString()); manager.cancelAll(); }
    }
    private boolean hasNotification(NotificationManager manager, int id) throws Exception {
        for (int attempt = 0; attempt < 20; attempt++) {
            for (android.service.notification.StatusBarNotification item : manager.getActiveNotifications()) if (item.getId() == id) return true;
            Thread.sleep(50);
        }
        return false;
    }
}
