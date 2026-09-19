package com.dailytaskai.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.core.app.NotificationCompat

class AlarmService : Service() {

    companion object {
        const val CHANNEL_ID = "daily_task_ai_alarm_channel"
        const val NOTIFICATION_ID = 9001
        private const val MAX_RING_DURATION_MS = 5 * 60 * 1000L // 5 minutes maximum
    }

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var currentTaskId: String? = null
    private val handler = Handler(Looper.getMainLooper())

    private val timeoutRunnable = Runnable {
        // 5-minute timeout reached
        stopRinging(isTimeout = true)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        val taskId = intent?.getStringExtra(AlarmReceiver.EXTRA_TASK_ID)

        if (action == AlarmReceiver.ACTION_STOP_RINGING) {
            stopRinging(isTimeout = false)
            return START_NOT_STICKY
        }

        if (taskId != null) {
            currentTaskId = taskId
            val title = intent.getStringExtra(AlarmReceiver.EXTRA_TITLE) ?: "Task Reminder"
            val message = intent.getStringExtra(AlarmReceiver.EXTRA_MESSAGE) ?: "Task is due now"

            startForegroundAlarm(taskId, title, message)
            startAudioAndVibration(taskId)

            // Schedule the 5-minute maximum timeout
            handler.removeCallbacks(timeoutRunnable)
            handler.postDelayed(timeoutRunnable, MAX_RING_DURATION_MS)
        }

        return START_NOT_STICKY
    }

    private fun startForegroundAlarm(taskId: String, title: String, message: String) {
        // Full screen intent for AlarmActivity
        val fullScreenIntent = Intent(this, AlarmActivity::class.java).apply {
            putExtra(AlarmReceiver.EXTRA_TASK_ID, taskId)
            putExtra(AlarmReceiver.EXTRA_TITLE, title)
            putExtra(AlarmReceiver.EXTRA_MESSAGE, message)
            this.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val fullScreenPendingIntent = PendingIntent.getActivity(
            this,
            taskId.hashCode(),
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // STOP RINGING action intent
        val stopIntent = Intent(this, AlarmReceiver::class.java).apply {
            action = AlarmReceiver.ACTION_STOP_RINGING
            putExtra(AlarmReceiver.EXTRA_TASK_ID, taskId)
        }
        val stopPendingIntent = PendingIntent.getBroadcast(
            this,
            (taskId + "_stop").hashCode(),
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                "STOP RINGING",
                stopPendingIntent
            )
            .build()

        startForeground(NOTIFICATION_ID, notification)
    }

    private fun startAudioAndVibration(taskId: String) {
        val soundType = AlarmStorage.getSoundType(this)
        val volumePercent = AlarmStorage.getVolume(this)
        val vibrate = AlarmStorage.getVibrate(this)

        // Audio playback on STREAM_ALARM
        try {
            val alertUri: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            mediaPlayer = MediaPlayer().apply {
                setDataSource(applicationContext, alertUri)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                val vol = (volumePercent.coerceIn(0, 100)) / 100f
                setVolume(vol, vol)
                isLooping = true
                prepare()
                start()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Vibration
        if (vibrate) {
            vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            vibrator?.let { vib ->
                val pattern = longArrayOf(0, 800, 400, 800, 1000)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vib.vibrate(VibrationEffect.createWaveform(pattern, 0)) // 0 means repeat
                } else {
                    @Suppress("DEPRECATION")
                    vib.vibrate(pattern, 0)
                }
            }
        }
    }

    private fun stopRinging(isTimeout: Boolean) {
        handler.removeCallbacks(timeoutRunnable)

        // Stop Audio
        try {
            mediaPlayer?.stop()
            mediaPlayer?.release()
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            mediaPlayer = null
        }

        // Stop Vibration
        try {
            vibrator?.cancel()
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            vibrator = null
        }

        val taskId = currentTaskId
        if (taskId != null) {
            val status = if (isTimeout) "TIMED_OUT" else "STOPPED_BY_USER"
            AlarmStorage.updateAlarmStatus(this, taskId, status)

            // Notify AlarmActivity to close
            val closeIntent = Intent("com.dailytaskai.alarm.DISMISS_UI").apply {
                putExtra(AlarmReceiver.EXTRA_TASK_ID, taskId)
                putExtra("status", status)
                setPackage(packageName)
            }
            sendBroadcast(closeIntent)
        }

        stopForeground(true)
        stopSelf()
    }

    override fun onDestroy() {
        handler.removeCallbacks(timeoutRunnable)
        try {
            mediaPlayer?.release()
        } catch (_: Exception) {}
        try {
            vibrator?.cancel()
        } catch (_: Exception) {}
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Daily Task Alarms",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Critical user-scheduled task alarms"
                setSound(null, null) // Sound is handled directly by MediaPlayer on USAGE_ALARM
                enableVibration(false) // Vibration is handled directly by Vibrator service
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }
}
