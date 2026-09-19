import { Task, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, CheckCircle2, Clock, X, BellRing, BellOff } from 'lucide-react';
import React, { useEffect } from 'react';
import { useAdManager } from '../lib/AdContext';
import { store } from '../lib/store';
import { playAlarmSound, stopAudio } from '../lib/audioManager';
import { ReminderService } from '../lib/ReminderService';

export function ReminderModal({
  task,
  userId,
  notificationPermission,
  onAcknowledge,
  onFulfill,
  onSnooze,
  onExpire
}: {
  task: Task,
  userId: string,
  notificationPermission?: NotificationPermission,
  onAcknowledge: () => void,
  onFulfill: () => void,
  onSnooze: (ms: number) => void,
  onExpire: () => void
}) {
  const { showAd } = useAdManager();
  
  const user = store.getCurrentUser();
  const isPremium = user?.subscriptionStatus === 'PREMIUM';
  
  useEffect(() => {
    // Start continuous alarm sound + vibration if enabled
    const soundType = user?.alarmSoundType || 'native';
    const volume = user?.alarmVolume ?? 75;
    const vibrate = user?.alarmVibrationEnabled ?? true;
    
    playAlarmSound(soundType as any, volume, vibrate).catch(err => {
      console.warn("Failed to play alarm sound automatically", err);
    });
    
    // Auto-expire after 5 minutes maximum ringing duration
    const expireTimer = setTimeout(() => {
      stopAudio();
      ReminderService.stopAlarm();
      onExpire();
    }, 5 * 60 * 1000);
    
    // Clean up audio and timers on unmount
    return () => {
      stopAudio();
      ReminderService.stopAlarm();
      clearTimeout(expireTimer);
    };
  }, [user]);

  // Immediate STOP RINGING action: stops sound + vibration, closes modal, does NOT fulfill task
  const handleStopRinging = async () => {
    try {
      stopAudio();
      ReminderService.stopAlarm();
      await onAcknowledge();
    } catch (err) {
      console.error('Error stopping ringing:', err);
    }
  };
  
  // Explicit TASK FULFILLED action: actually completed the task
  const handleFulfill = async () => {
    try {
      stopAudio();
      ReminderService.stopAlarm();
      await onFulfill();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSnooze = async (ms: number) => {
    try {
      stopAudio();
      ReminderService.stopAlarm();
      await onSnooze(ms);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex flex-col justify-center items-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-red-950/90 backdrop-blur-md"
        />
        
        <motion.div 
          initial={{ scale: 0.9, y: 50, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 50, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-3xl p-6 relative z-10 w-full max-w-sm shadow-2xl flex flex-col items-center"
        >
          <div className="bg-red-100 p-5 rounded-full animate-pulse shadow-xl shadow-red-500/30 mb-5">
            <BellRing className="w-12 h-12 text-red-600 animate-bounce" />
          </div>
          
          <h3 className="text-2xl font-black text-center text-red-600 mb-1 uppercase tracking-tight">Task Reminder</h3>
          <p className="text-center text-slate-500 mb-5 font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            Alarm Ringing (5 min max)
          </p>
          
          <div className="w-full bg-red-50/80 border-2 border-red-100 rounded-2xl p-5 mb-6 text-center shadow-inner">
            <p className="text-xl font-bold text-slate-900 leading-tight mb-3">{task.taskText}</p>
            <div className="flex justify-center gap-3 text-xs text-red-700 font-bold">
              <span>{task.scheduledDate}</span>
              <span>•</span>
              <span>{task.scheduledTime}</span>
            </div>
          </div>
          
          {/* Prominent STOP RINGING Button */}
          <div className="w-full mb-5">
            <button 
              id="stop-ringing-btn"
              type="button"
              onClick={handleStopRinging}
              className="w-full bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-black py-4 px-6 rounded-2xl transition-all text-xl tracking-wide shadow-xl shadow-red-600/30 flex items-center justify-center gap-3 cursor-pointer"
            >
              <BellOff className="w-6 h-6" />
              STOP RINGING
            </button>
            <p className="text-center text-[11px] text-slate-500 mt-2 font-medium">
              Stops sound & vibration. Does not complete the task.
            </p>
          </div>
          
          {/* Separate Task Fulfillment & Snooze Section */}
          <div className="w-full border-t border-slate-100 pt-5">
             <div className="flex flex-col gap-3">
              <button 
                id="task-fulfilled-btn"
                type="button"
                onClick={handleFulfill}
                className="w-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold py-3.5 rounded-xl hover:bg-emerald-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Task Fulfilled
              </button>
              
              <div className="grid grid-cols-3 gap-2">
                <button 
                  type="button"
                  onClick={() => handleSnooze(10 * 60 * 1000)}
                  className="bg-white border border-slate-200 text-slate-600 font-bold py-2.5 rounded-xl hover:bg-slate-50 active:scale-[0.98] transition-all text-xs"
                >
                  Snooze 10m
                </button>
                <button 
                  type="button"
                  onClick={() => handleSnooze(30 * 60 * 1000)}
                  className="bg-white border border-slate-200 text-slate-600 font-bold py-2.5 rounded-xl hover:bg-slate-50 active:scale-[0.98] transition-all text-xs"
                >
                  Snooze 30m
                </button>
                <button 
                  type="button"
                  onClick={() => handleSnooze(60 * 60 * 1000)}
                  className="bg-white border border-slate-200 text-slate-600 font-bold py-2.5 rounded-xl hover:bg-slate-50 active:scale-[0.98] transition-all text-xs"
                >
                  Snooze 1h
                </button>
              </div>
            </div>
          </div>
          
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
