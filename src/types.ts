export type TaskStatus = 'Pending' | 'Fulfilled' | 'Not Fulfilled' | 'Cancelled';
export type ReminderStatus = 'Scheduled' | 'Triggered' | 'Acknowledged' | 'Snoozed' | 'Cancelled' | 'Completed';
export type AlarmStatus = 
  | 'SCHEDULED' 
  | 'RINGING' 
  | 'STOPPED_BY_USER' 
  | 'TIMED_OUT' 
  | 'CANCELLED' 
  | 'COMPLETED' 
  | 'SNOOZED'
  // Backward compatibility with legacy lowercase values
  | 'scheduled' | 'ringing' | 'acknowledged' | 'expired' | 'snoozed' | 'cancelled' | 'fulfilled';

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
  alarmStoppedAt?: number | null;
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

  // Phase 5B: Meet Profile Foundation & Adult Verification
  profilePhotoUrl?: string | null;
  maritalStatus?: 'Single' | 'Married' | null;
  phoneNumber?: string | null;
  phoneVerified?: boolean;
  meetSetupCompleted?: boolean;
  meetEnabled?: boolean;
  city?: string | null;
  locationPermissionStatus?: 'prompt' | 'granted' | 'denied';
  privateLatitude?: number | null;
  privateLongitude?: number | null;
  lastSeenAt?: number | string | null;
  isOnline?: boolean;
}
