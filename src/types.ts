export type TaskStatus = 'Pending' | 'Fulfilled' | 'Not Fulfilled' | 'Cancelled';
export type ReminderStatus = 'Scheduled' | 'Triggered' | 'Acknowledged' | 'Snoozed' | 'Cancelled' | 'Completed';
export type AlarmStatus = 'scheduled' | 'ringing' | 'acknowledged' | 'expired' | 'snoozed' | 'cancelled' | 'fulfilled';

export interface Task {
  id: string;
  userId: string;
  taskText: string;
  scheduledDate: string;
  scheduledTime: string;
  timezone?: string;
  status: TaskStatus;
  reminderStatus?: ReminderStatus;
  recurrenceRule?: string; // Foundation for recurring tasks
  createdTimestamp: number;
  completedTimestamp: number | null;
  snoozedUntil?: number | null;
  
  // Alarm Tracking
  alarmStatus?: AlarmStatus;
  alarmStartedAt?: number | null;
  alarmAcknowledgedAt?: number | null;
  alarmExpiredAt?: number | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  country: string;
  age: string;
  timezone?: string;
  subscriptionStatus: string;
  
  // Alarm Settings
  alarmSoundType?: 'native' | 'classic' | 'strong' | 'urgent' | 'custom';
  alarmSoundReference?: string | null;
  alarmVolume?: number; // 0-100
  alarmVibrationEnabled?: boolean;
}
