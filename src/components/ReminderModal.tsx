import { Task, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, CheckCircle2, Clock, X, BellRing } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
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
  const [inputText, setInputText] = useState('');
  
  useEffect(() => {
    // Start continuous alarm sound
    const soundType = user?.alarmSoundType || 'strong';
    const volume = user?.alarmVolume ?? 75;
    
    playAlarmSound(soundType, volume).catch(err => {
      console.warn("Failed to play alarm sound automatically", err);
    });
    
    // Auto-expire after 5 minutes
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

  const handleAcknowledgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim().toLowerCase() === 'i have seen it') {
      try {
        stopAudio();
        ReminderService.stopAlarm();
        await onAcknowledge();
        if (!isPremium) {
          try {
            await showAd('interstitial');
          } catch (err) {
            console.error('Ad display failed:', err);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
  };
  
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
          className="absolute inset-0 bg-red-900/90 backdrop-blur-md"
        />
        
        <motion.div 
          initial={{ scale: 0.9, y: 50, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 50, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-3xl p-6 relative z-10 w-full max-w-sm shadow-2xl flex flex-col items-center"
        >
          <div className="bg-red-100 p-5 rounded-full animate-pulse shadow-xl shadow-red-500/30 mb-6">
            <BellRing className="w-12 h-12 text-red-600 animate-bounce" />
          </div>
          
          <h3 className="text-3xl font-black text-center text-red-600 mb-2 uppercase tracking-tight">Task Reminder</h3>
          <p className="text-center text-slate-500 mb-6 font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            Alarm Ringing
          </p>
          
          <div className="w-full bg-red-50 border-2 border-red-100 rounded-2xl p-6 mb-8 text-center shadow-inner">
            <p className="text-2xl font-bold text-slate-900 leading-tight mb-4">{task.taskText}</p>
            <div className="flex justify-center gap-3 text-sm text-red-700 font-bold">
              <span>{task.scheduledDate}</span>
              <span>•</span>
              <span>{task.scheduledTime}</span>
            </div>
          </div>
          
          <div className="w-full mb-6">
            <form onSubmit={handleAcknowledgeSubmit} className="flex flex-col gap-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                Type "I have seen it" to stop alarm
              </label>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="I have seen it"
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-center font-bold text-slate-900 focus:border-red-500 focus:ring-4 focus:ring-red-500/20 outline-none transition-all placeholder:font-normal placeholder:text-slate-300"
              />
              <button 
                type="submit"
                disabled={inputText.trim().toLowerCase() !== 'i have seen it'}
                className="w-full bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 active:scale-[0.98] transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-600/30"
              >
                CONFIRM & STOP ALARM
              </button>
            </form>
          </div>
          
          <div className="w-full border-t border-slate-100 pt-6">
             <div className="flex flex-col gap-3">
              <button 
                onClick={handleFulfill}
                className="w-full bg-green-50 border border-green-200 text-green-700 font-bold py-3.5 rounded-xl hover:bg-green-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                Task Fulfilled
              </button>
              
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => handleSnooze(10 * 60 * 1000)}
                  className="bg-white border border-slate-200 text-slate-600 font-bold py-2.5 rounded-xl hover:bg-slate-50 active:scale-[0.98] transition-all text-xs"
                >
                  Snooze 10m
                </button>
                <button 
                  onClick={() => handleSnooze(30 * 60 * 1000)}
                  className="bg-white border border-slate-200 text-slate-600 font-bold py-2.5 rounded-xl hover:bg-slate-50 active:scale-[0.98] transition-all text-xs"
                >
                  Snooze 30m
                </button>
                <button 
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
