/**
 * Ad Event Tracking & Analytics System
 * Records lifecycle events for monetization & ad placements without storing unnecessary PII.
 */

export type AdEventName =
  | 'alarm_stop_ad_requested'
  | 'alarm_stop_ad_shown'
  | 'alarm_stop_ad_completed'
  | 'alarm_stop_ad_failed'
  | 'meet_opened'
  | 'meet_near_me_ad_requested'
  | 'meet_near_me_ad_shown'
  | 'meet_near_me_ad_completed'
  | 'meet_near_me_ad_failed'
  | 'meet_worldwide_ad_1_requested'
  | 'meet_worldwide_ad_1_shown'
  | 'meet_worldwide_ad_1_completed'
  | 'meet_worldwide_ad_2_requested'
  | 'meet_worldwide_ad_2_shown'
  | 'meet_worldwide_ad_2_completed'
  | 'chat_ad_requested'
  | 'chat_ad_shown'
  | 'chat_ad_completed'
  | 'chat_ad_failed'
  | 'add_friend_ad_requested'
  | 'add_friend_ad_shown'
  | 'add_friend_ad_completed'
  | 'add_friend_ad_failed';

export interface AdEventRecord {
  id: string;
  eventName: AdEventName;
  timestamp: number;
  meta?: Record<string, any>;
}

const STORAGE_KEY = 'daily_task_ai_ad_events';
const memoryEvents: AdEventRecord[] = [];

export const adAnalytics = {
  track(eventName: AdEventName, meta?: Record<string, any>): AdEventRecord {
    const record: AdEventRecord = {
      id: `${eventName}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      eventName,
      timestamp: Date.now(),
      meta
    };

    memoryEvents.push(record);
    if (memoryEvents.length > 500) {
      memoryEvents.shift();
    }

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        existing.push(record);
        if (existing.length > 200) existing.shift();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
      }
    } catch (e) {
      console.warn('Could not persist ad event:', e);
    }

    // Inform developer console in non-production
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AdAnalytics] ${eventName}`, meta || '');
    }

    return record;
  },

  getEvents(): AdEventRecord[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Could not read stored ad events:', e);
    }
    return [...memoryEvents];
  },

  hasEvent(eventName: AdEventName): boolean {
    return this.getEvents().some(e => e.eventName === eventName);
  },

  getEventCount(eventName: AdEventName): number {
    return this.getEvents().filter(e => e.eventName === eventName).length;
  },

  clear() {
    memoryEvents.length = 0;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Could not clear stored ad events:', e);
    }
  }
};
