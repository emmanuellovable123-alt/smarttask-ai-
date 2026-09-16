import { Task, ReminderStatus } from '../types';
import { getCustomAudioName } from './audioManager';

export interface ScheduledReminder {
  taskId: string;
  userId: string;
  taskText: string;
  scheduledDate: string;
  scheduledTime: string;
  timezone?: string;
  status: ReminderStatus;
  triggerTimeMs: number;
}

// In-memory registry of active reminders (for web implementation)
const activeTimeouts = new Map<string, number>();
const scheduledReminders = new Map<string, ScheduledReminder>();
export type ReminderCallback = (reminder: ScheduledReminder) => void;
let onReminderTriggered: ReminderCallback | null = null;

// Helper to interact with Native Android Wrapper if it exists
const AndroidWrapper = {
  get isAvailable() {
    return typeof window !== 'undefined' && (window as any).AndroidAlarmManager !== undefined;
  },
  scheduleAlarm(id: string, timeMs: number, title: string, message: string) {
    if (this.isAvailable) {
      (window as any).AndroidAlarmManager.scheduleAlarm(id, timeMs, title, message);
      return true;
    }
    return false;
  },
  cancelAlarm(id: string) {
    if (this.isAvailable) {
      (window as any).AndroidAlarmManager.cancelAlarm(id);
      return true;
    }
    return false;
  },
  syncSettings(soundType: string, volume: number, customFileName: string | null) {
    if (this.isAvailable) {
      (window as any).AndroidAlarmManager.syncSettings(soundType, volume, customFileName || '');
    }
  },
  stopAlarm() {
    if (this.isAvailable && (window as any).AndroidAlarmManager.stopAlarm) {
      (window as any).AndroidAlarmManager.stopAlarm();
    }
  }
};

export const ReminderService = {
  setCallback(callback: ReminderCallback) {
    onReminderTriggered = callback;
    // Bind a global function so Android can trigger the JS callback when an alarm goes off while app is open
    if (typeof window !== 'undefined') {
      (window as any).triggerAndroidAlarm = (taskId: string) => {
        const reminder = scheduledReminders.get(taskId);
        if (reminder && onReminderTriggered) {
          reminder.status = 'Triggered';
          onReminderTriggered(reminder);
        }
      };
    }
  },
  
  async syncAlarmSettings(soundType: string, volume: number) {
    const customName = await getCustomAudioName();
    AndroidWrapper.syncSettings(soundType, volume, customName);
  },

  scheduleReminder(task: Task, triggerTimeMs: number) {
    // Prevent duplicate scheduling
    if (activeTimeouts.has(task.id) || scheduledReminders.has(task.id)) {
      const existing = scheduledReminders.get(task.id);
      if (existing && existing.triggerTimeMs === triggerTimeMs) {
        return; // Already scheduled for exactly this time
      }
      this.cancelReminder(task.id); // Cancel old one if time changed
    }

    const now = Date.now();
    const delay = triggerTimeMs - now;
    if (delay < 0) return; // In the past

    const reminder: ScheduledReminder = {
      taskId: task.id,
      userId: task.userId,
      taskText: task.taskText,
      scheduledDate: task.scheduledDate,
      scheduledTime: task.scheduledTime,
      timezone: task.timezone,
      status: 'Scheduled',
      triggerTimeMs
    };
    
    scheduledReminders.set(task.id, reminder);

    // If native wrapper is available, use it (works in background/locked)
    if (AndroidWrapper.isAvailable) {
      AndroidWrapper.scheduleAlarm(task.id, triggerTimeMs, "Task Reminder", task.taskText);
    } else {
      // Web fallback
      const timeoutId = window.setTimeout(() => {
        activeTimeouts.delete(task.id);
        reminder.status = 'Triggered';
        scheduledReminders.set(task.id, reminder);
        if (onReminderTriggered) {
          onReminderTriggered(reminder);
        }
      }, delay);
      activeTimeouts.set(task.id, timeoutId);
    }
  },

  cancelReminder(taskId: string) {
    if (AndroidWrapper.isAvailable) {
      AndroidWrapper.cancelAlarm(taskId);
    } else {
      const timeoutId = activeTimeouts.get(taskId);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        activeTimeouts.delete(taskId);
      }
    }
    
    const reminder = scheduledReminders.get(taskId);
    if (reminder) {
      reminder.status = 'Cancelled';
      scheduledReminders.set(taskId, reminder);
    }
  },

  rescheduleReminder(task: Task, newTriggerTimeMs: number) {
    this.cancelReminder(task.id);
    this.scheduleReminder(task, newTriggerTimeMs);
  },

  snoozeReminder(taskId: string, minutes: number) {
    this.cancelReminder(taskId);
    const reminder = scheduledReminders.get(taskId);
    
    if (reminder) {
      reminder.status = 'Snoozed';
      const newTriggerTimeMs = Date.now() + minutes * 60 * 1000;
      reminder.triggerTimeMs = newTriggerTimeMs;
      scheduledReminders.set(taskId, reminder);
      
      if (AndroidWrapper.isAvailable) {
        AndroidWrapper.scheduleAlarm(taskId, newTriggerTimeMs, "Task Reminder", reminder.taskText);
      } else {
        const delay = newTriggerTimeMs - Date.now();
        const timeoutId = window.setTimeout(() => {
          activeTimeouts.delete(taskId);
          reminder.status = 'Triggered';
          scheduledReminders.set(taskId, reminder);
          if (onReminderTriggered) {
            onReminderTriggered(reminder);
          }
        }, delay);
        activeTimeouts.set(taskId, timeoutId);
      }
    }
  },

  stopAlarm() {
    if (AndroidWrapper.isAvailable) {
      AndroidWrapper.stopAlarm();
    }
  },

  getScheduledReminders(): ScheduledReminder[] {
    return Array.from(scheduledReminders.values());
  },
  
  cancelAllUserReminders() {
    activeTimeouts.forEach(id => window.clearTimeout(id));
    activeTimeouts.clear();
    
    if (AndroidWrapper.isAvailable) {
      for (const id of scheduledReminders.keys()) {
        AndroidWrapper.cancelAlarm(id);
      }
    }
    scheduledReminders.clear();
  }
};
