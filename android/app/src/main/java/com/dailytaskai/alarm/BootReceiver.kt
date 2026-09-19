package com.dailytaskai.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action == Intent.ACTION_BOOT_COMPLETED ||
            action == Intent.ACTION_LOCKED_BOOT_COMPLETED ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED ||
            action == "android.intent.action.QUICKBOOT_POWERON" ||
            action == "com.htc.intent.action.QUICKBOOT_POWERON"
        ) {
            rescheduleFutureAlarms(context)
        }
    }

    private fun rescheduleFutureAlarms(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val now = System.currentTimeMillis()

        val allAlarms = AlarmStorage.getAllAlarms(context)

        for (alarm in allAlarms) {
            // Check validity: must be SCHEDULED, not CANCELLED, not COMPLETED, and in the future
            if (alarm.status == "SCHEDULED" && alarm.timeMs > now) {
                scheduleExactAlarm(context, alarmManager, alarm)
            }
        }
    }

    private fun scheduleExactAlarm(context: Context, alarmManager: AlarmManager, alarm: StoredAlarm) {
        val alarmIntent = Intent(context, AlarmReceiver::class.java).apply {
            action = AlarmReceiver.ACTION_ALARM_TRIGGER
            putExtra(AlarmReceiver.EXTRA_TASK_ID, alarm.id)
            putExtra(AlarmReceiver.EXTRA_TITLE, alarm.title)
            putExtra(AlarmReceiver.EXTRA_MESSAGE, alarm.message)
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            alarm.id.hashCode(),
            alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Show Intent for AlarmClockInfo
        val showIntent = Intent(context, MainActivity::class.java)
        val showPendingIntent = PendingIntent.getActivity(
            context,
            alarm.id.hashCode() + 1,
            showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val alarmClockInfo = AlarmManager.AlarmClockInfo(alarm.timeMs, showPendingIntent)

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
                } else {
                    // Fallback to window / inexact if user revoked permission
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alarm.timeMs, pendingIntent)
                }
            } else {
                alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
