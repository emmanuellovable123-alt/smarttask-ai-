package com.dailytaskai.alarm

import android.app.Activity
import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class AlarmActivity : Activity() {

    private var taskId: String? = null

    private val dismissReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val targetTaskId = intent.getStringExtra(AlarmReceiver.EXTRA_TASK_ID)
            if (targetTaskId == null || targetTaskId == taskId) {
                finishAndRemoveTask()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Configure screen wake, turn-on, and show over lock screen
        setupLockscreenFlags()

        taskId = intent.getStringExtra(AlarmReceiver.EXTRA_TASK_ID)
        val title = intent.getStringExtra(AlarmReceiver.EXTRA_TITLE) ?: "Task Reminder"
        val message = intent.getStringExtra(AlarmReceiver.EXTRA_MESSAGE) ?: "You have a scheduled task"

        // Register dismiss broadcast receiver
        val filter = IntentFilter("com.dailytaskai.alarm.DISMISS_UI")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(dismissReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(dismissReceiver, filter)
        }

        // Programmatic high-contrast alarm layout with STOP RINGING button
        setContentView(createAlarmView(title, message))
    }

    private fun setupLockscreenFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
            keyguardManager?.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    private fun createAlarmView(titleText: String, messageText: String): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0F172A")) // Slate 900
            setPadding(48, 64, 48, 64)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        // Alarm Subtitle
        val subheader = TextView(this).apply {
            text = "DAILY TASK AI • ALARM RINGING"
            textSize = 12f
            setTextColor(Color.parseColor("#EF4444")) // Red 500
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 16)
        }
        root.addView(subheader)

        // Task Title
        val title = TextView(this).apply {
            text = titleText
            textSize = 28f
            setTextColor(Color.WHITE)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 16)
        }
        root.addView(title)

        // Task Message / Details
        if (messageText.isNotEmpty()) {
            val message = TextView(this).apply {
                text = messageText
                textSize = 18f
                setTextColor(Color.parseColor("#94A3B8")) // Slate 400
                gravity = Gravity.CENTER
                setPadding(0, 0, 0, 48)
            }
            root.addView(message)
        }

        // STOP RINGING BUTTON
        val stopButton = Button(this).apply {
            text = "STOP RINGING"
            textSize = 20f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#DC2626")) // Red 600
            setPadding(32, 32, 32, 32)
            elevation = 16f
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(0, 32, 0, 16)
            }
            setOnClickListener {
                onStopRingingClicked()
            }
        }
        root.addView(stopButton)

        val note = TextView(this).apply {
            text = "Stops sound & vibration. Does not complete the task."
            textSize = 12f
            setTextColor(Color.parseColor("#64748B"))
            gravity = Gravity.CENTER
        }
        root.addView(note)

        return root
    }

    private fun onStopRingingClicked() {
        val id = taskId
        if (id != null) {
            // Send action to stop alarm sound and vibration immediately
            val stopIntent = Intent(this, AlarmReceiver::class.java).apply {
                action = AlarmReceiver.ACTION_STOP_RINGING
                putExtra(AlarmReceiver.EXTRA_TASK_ID, id)
            }
            sendBroadcast(stopIntent)

            // Mark alarm instance as STOPPED_BY_USER
            AlarmStorage.updateAlarmStatus(this, id, "STOPPED_BY_USER")
        }

        finishAndRemoveTask()
    }

    override fun onDestroy() {
        try {
            unregisterReceiver(dismissReceiver)
        } catch (_: Exception) {}
        super.onDestroy()
    }
}
