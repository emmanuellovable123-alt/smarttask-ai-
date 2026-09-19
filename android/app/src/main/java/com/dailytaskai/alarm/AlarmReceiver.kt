package com.dailytaskai.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import androidx.core.content.ContextCompat

class AlarmReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_ALARM_TRIGGER = "com.dailytaskai.alarm.ACTION_ALARM_TRIGGER"
        const val ACTION_STOP_RINGING = "com.dailytaskai.alarm.ACTION_STOP_RINGING"
        const val EXTRA_TASK_ID = "extra_task_id"
        const val EXTRA_TITLE = "extra_title"
        const val EXTRA_MESSAGE = "extra_message"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val taskId = intent.getStringExtra(EXTRA_TASK_ID) ?: return

        when (action) {
            ACTION_ALARM_TRIGGER -> {
                val title = intent.getStringExtra(EXTRA_TITLE) ?: "Task Reminder"
                val message = intent.getStringExtra(EXTRA_MESSAGE) ?: "You have a scheduled task"

                // Mark alarm state as RINGING
                AlarmStorage.updateAlarmStatus(context, taskId, "RINGING")

                // Acquire temporary WakeLock to ensure CPU does not sleep during service & activity launch
                val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
                val wakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
                    "DailyTaskAI:AlarmReceiverWakeLock"
                )
                wakeLock.acquire(30000L) // Safe 30s timeout

                try {
                    // Start AlarmService to handle audio on STREAM_ALARM, vibration, notification, and 5-min timeout
                    val serviceIntent = Intent(context, AlarmService::class.java).apply {
                        putExtra(EXTRA_TASK_ID, taskId)
                        putExtra(EXTRA_TITLE, title)
                        putExtra(EXTRA_MESSAGE, message)
                    }
                    ContextCompat.startForegroundService(context, serviceIntent)

                    // Launch full-screen AlarmActivity
                    val activityIntent = Intent(context, AlarmActivity::class.java).apply {
                        putExtra(EXTRA_TASK_ID, taskId)
                        putExtra(EXTRA_TITLE, title)
                        putExtra(EXTRA_MESSAGE, message)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                                Intent.FLAG_ACTIVITY_SINGLE_TOP
                    }
                    context.startActivity(activityIntent)
                } finally {
                    if (wakeLock.isHeld) {
                        wakeLock.release()
                    }
                }
            }

            ACTION_STOP_RINGING -> {
                // User pressed STOP RINGING from notification
                val stopServiceIntent = Intent(context, AlarmService::class.java).apply {
                    this.action = ACTION_STOP_RINGING
                    putExtra(EXTRA_TASK_ID, taskId)
                }
                context.startService(stopServiceIntent)
            }
        }
    }
}
