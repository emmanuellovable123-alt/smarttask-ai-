package com.dailytaskai.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.webkit.JavascriptInterface

class AndroidAlarmManagerInterface(private val context: Context) {

    private val alarmManager: AlarmManager? =
        context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager

    @JavascriptInterface
    fun scheduleAlarm(id: String, timeMs: Long, title: String, message: String): Boolean {
        if (alarmManager == null) return false

        // 1. Persist alarm in SharedPreferences for reboot restoration
        val soundType = AlarmStorage.getSoundType(context)
        val volume = AlarmStorage.getVolume(context)
        val vibrate = AlarmStorage.getVibrate(context)

        val alarm = StoredAlarm(
            id = id,
            timeMs = timeMs,
            title = title,
            message = message,
            soundType = soundType,
            volume = volume,
            vibrate = vibrate,
            status = "SCHEDULED"
        )
        AlarmStorage.saveAlarm(context, alarm)

        // 2. Schedule native AlarmManager.setAlarmClock()
        val alarmIntent = Intent(context, AlarmReceiver::class.java).apply {
            action = AlarmReceiver.ACTION_ALARM_TRIGGER
            putExtra(AlarmReceiver.EXTRA_TASK_ID, id)
            putExtra(AlarmReceiver.EXTRA_TITLE, title)
            putExtra(AlarmReceiver.EXTRA_MESSAGE, message)
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            id.hashCode(),
            alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val showIntent = Intent(context, MainActivity::class.java)
        val showPendingIntent = PendingIntent.getActivity(
            context,
            id.hashCode() + 1,
            showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val alarmClockInfo = AlarmManager.AlarmClockInfo(timeMs, showPendingIntent)

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
                } else {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timeMs, pendingIntent)
                }
            } else {
                alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
            }
            return true
        } catch (e: Exception) {
            e.printStackTrace()
            return false
        }
    }

    @JavascriptInterface
    fun cancelAlarm(id: String): Boolean {
        if (alarmManager == null) return false

        AlarmStorage.updateAlarmStatus(context, id, "CANCELLED")
        AlarmStorage.removeAlarm(context, id)

        val alarmIntent = Intent(context, AlarmReceiver::class.java).apply {
            action = AlarmReceiver.ACTION_ALARM_TRIGGER
            putExtra(AlarmReceiver.EXTRA_TASK_ID, id)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            id.hashCode(),
            alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        alarmManager.cancel(pendingIntent)
        return true
    }

    @JavascriptInterface
    fun cancelAllAlarms(): Boolean {
        val alarms = AlarmStorage.getAllAlarms(context)
        for (a in alarms) {
            cancelAlarm(a.id)
        }
        return true
    }

    @JavascriptInterface
    fun stopAlarm() {
        val stopServiceIntent = Intent(context, AlarmService::class.java).apply {
            action = AlarmReceiver.ACTION_STOP_RINGING
        }
        context.startService(stopServiceIntent)
    }

    @JavascriptInterface
    fun syncSettings(soundType: String, volume: Int, customFileName: String?, vibrate: Boolean) {
        AlarmStorage.savePreferences(context, soundType, volume, vibrate)
    }

    @JavascriptInterface
    fun canScheduleExactAlarm(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return alarmManager?.canScheduleExactAlarms() ?: true
        }
        return true
    }

    @JavascriptInterface
    fun openExactAlarmSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                data = Uri.parse("package:${context.packageName}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        }
    }

    @JavascriptInterface
    fun openNotificationSettings() {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
        } else {
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:${context.packageName}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
        }
        context.startActivity(intent)
    }

    @JavascriptInterface
    fun isBatteryOptimizationIgnored(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
            return pm?.isIgnoringBatteryOptimizations(context.packageName) ?: true
        }
        return true
    }

    @JavascriptInterface
    fun requestIgnoreBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${context.packageName}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        }
    }

    @JavascriptInterface
    fun getPlatform(): String = "android"
}
