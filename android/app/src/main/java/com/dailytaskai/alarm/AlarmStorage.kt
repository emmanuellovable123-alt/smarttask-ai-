package com.dailytaskai.alarm

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

data class StoredAlarm(
    val id: String,
    val timeMs: Long,
    val title: String,
    val message: String,
    val soundType: String = "native",
    val volume: Int = 75,
    val vibrate: Boolean = true,
    val status: String = "SCHEDULED" // SCHEDULED, RINGING, STOPPED_BY_USER, TIMED_OUT, CANCELLED, COMPLETED
)

object AlarmStorage {
    private const val PREFS_NAME = "daily_task_alarms_pref"
    private const val KEY_ALARMS = "active_alarms_list"
    private const val KEY_SOUND_PREF = "pref_sound_type"
    private const val KEY_VOLUME_PREF = "pref_volume"
    private const val KEY_VIBRATE_PREF = "pref_vibrate"

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    fun saveAlarm(context: Context, alarm: StoredAlarm) {
        val alarms = getAllAlarms(context).toMutableList()
        alarms.removeAll { it.id == alarm.id }
        alarms.add(alarm)
        saveList(context, alarms)
    }

    fun removeAlarm(context: Context, id: String) {
        val alarms = getAllAlarms(context).toMutableList()
        alarms.removeAll { it.id == id }
        saveList(context, alarms)
    }

    fun updateAlarmStatus(context: Context, id: String, status: String) {
        val alarms = getAllAlarms(context).map {
            if (it.id == id) it.copy(status = status) else it
        }
        saveList(context, alarms)
    }

    fun getAlarm(context: Context, id: String): StoredAlarm? {
        return getAllAlarms(context).find { it.id == id }
    }

    fun getAllAlarms(context: Context): List<StoredAlarm> {
        val jsonStr = getPrefs(context).getString(KEY_ALARMS, "[]") ?: "[]"
        val list = mutableListOf<StoredAlarm>()
        try {
            val arr = JSONArray(jsonStr)
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                list.add(
                    StoredAlarm(
                        id = obj.getString("id"),
                        timeMs = obj.getLong("timeMs"),
                        title = obj.optString("title", "Task Reminder"),
                        message = obj.optString("message", ""),
                        soundType = obj.optString("soundType", "native"),
                        volume = obj.optInt("volume", 75),
                        vibrate = obj.optBoolean("vibrate", true),
                        status = obj.optString("status", "SCHEDULED")
                    )
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return list
    }

    private fun saveList(context: Context, alarms: List<StoredAlarm>) {
        val arr = JSONArray()
        for (a in alarms) {
            val obj = JSONObject()
            obj.put("id", a.id)
            obj.put("timeMs", a.timeMs)
            obj.put("title", a.title)
            obj.put("message", a.message)
            obj.put("soundType", a.soundType)
            obj.put("volume", a.volume)
            obj.put("vibrate", a.vibrate)
            obj.put("status", a.status)
            arr.put(obj)
        }
        getPrefs(context).edit().putString(KEY_ALARMS, arr.toString()).apply()
    }

    fun savePreferences(context: Context, soundType: String, volume: Int, vibrate: Boolean) {
        getPrefs(context).edit()
            .putString(KEY_SOUND_PREF, soundType)
            .putInt(KEY_VOLUME_PREF, volume)
            .putBoolean(KEY_VIBRATE_PREF, vibrate)
            .apply()
    }

    fun getSoundType(context: Context): String = getPrefs(context).getString(KEY_SOUND_PREF, "native") ?: "native"
    fun getVolume(context: Context): Int = getPrefs(context).getInt(KEY_VOLUME_PREF, 75)
    fun getVibrate(context: Context): Boolean = getPrefs(context).getBoolean(KEY_VIBRATE_PREF, true)
}
