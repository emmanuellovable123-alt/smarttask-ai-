import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { LogOut, Bell, CalendarClock, Volume2, Music, Upload, Play, Square, Smartphone, ShieldCheck, AlertCircle, Info, Zap, Users, Eye, EyeOff } from 'lucide-react';
import { supabase, hasSupabaseKeys } from '../lib/supabase';
import { saveCustomAudio, getCustomAudioName, playAlarmSound, stopAudio } from '../lib/audioManager';
import { ReminderService } from '../lib/ReminderService';
import { canUseMeet } from '../lib/meetEligibility';
import { AdBanner } from './AdBanner';

export function SettingsView({ user, onLogout, onUpdateUser }: { user: User, onLogout: () => void, onUpdateUser: (u: User) => void }) {
  const [soundType, setSoundType] = useState(user.alarmSoundType || 'native');
  const [volume, setVolume] = useState(user.alarmVolume ?? 75);
  const [vibrationEnabled, setVibrationEnabled] = useState(user.alarmVibrationEnabled ?? true);
  const [customName, setCustomName] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCustomAudioName()
      .then(name => {
        if (name) setCustomName(name);
      })
      .catch(err => console.warn('Failed to load custom audio name:', err));
  }, []);

  const handleRequestNotification = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default' || Notification.permission === 'denied') {
         try {
           const requestPromise = Notification.requestPermission((permission) => {
             if (permission !== 'default') window.location.reload();
           });
           if (requestPromise && typeof requestPromise.then === 'function') {
             await requestPromise;
             window.location.reload();
           }
         } catch (err) {
           console.warn('Notification permission error:', err);
         }
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!['audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/x-m4a', 'audio/mp4'].includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|aac|ogg)$/i)) {
        alert("Please select a valid audio file (MP3, WAV, M4A, OGG).");
        return;
      }
      try {
        const name = await saveCustomAudio(file);
        setCustomName(name);
        setSoundType('custom');
      } catch (err) {
        console.error("Failed to save audio file", err);
        alert("Failed to save audio file.");
      }
    }
  };

  const togglePreview = async () => {
    if (isPlaying) {
      stopAudio();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      try {
        await playAlarmSound(soundType as any, volume, vibrationEnabled);
        // Auto-stop preview after 5 seconds to prevent annoyance
        setTimeout(() => {
          stopAudio();
          setIsPlaying(false);
        }, 5000);
      } catch (err) {
        console.warn('Preview error:', err);
        setIsPlaying(false);
      }
    }
  };
  
  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  const handleVibrationChange = async (enabled: boolean) => {
    try {
      setVibrationEnabled(enabled);
      const updatedUser = {
        ...user,
        alarmSoundType: soundType as any,
        alarmVolume: volume,
        alarmVibrationEnabled: enabled
      };
      await onUpdateUser(updatedUser);
      ReminderService.syncAlarmSettings(soundType, volume, enabled).catch(e => console.warn(e));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      const updatedUser = {
        ...user,
        alarmSoundType: soundType as any,
        alarmVolume: volume,
        alarmVibrationEnabled: vibrationEnabled
      };
      
      // Save to App state and localStorage
      await onUpdateUser(updatedUser);
      
      // Sync to Native Android wrapper if available
      ReminderService.syncAlarmSettings(soundType, volume, vibrationEnabled).catch(e => console.warn(e));
      
      // Attempt Supabase save
      if (hasSupabaseKeys) {
        try {
          await supabase.from('profiles').update({ 
             alarm_sound_type: soundType,
             alarm_volume: volume,
             alarm_vibration_enabled: vibrationEnabled
          }).eq('id', user.id);
        } catch (err) {
          // Ignore DB update errors since it's saved locally
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 relative h-full">
      <div className="bg-white px-6 pt-8 pb-6 border-b border-slate-100 flex-shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 leading-tight">Settings</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-40 space-y-8">
        
        {/* Profile */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1">Profile</h3>
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="flex items-center gap-4 p-4 border-b border-slate-50">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-slate-900">{user.name}</p>
                <p className="text-sm text-slate-500">{user.email}</p>
              </div>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4 bg-slate-50/50">
              <div>
                <p className="text-xs text-slate-400 font-medium">Country</p>
                <p className="font-semibold text-slate-700">{user.country}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Status</p>
                <p className="font-semibold text-slate-700">{user.subscriptionStatus}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Reminders & Alarm */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1">Reminders & Alarm</h3>
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            
            <div className="p-4 border-b border-slate-50">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Music className="w-5 h-5" />
                </div>
                <p className="font-semibold text-slate-900">Alarm Sound</p>
              </div>
              
              <div className="space-y-2 mb-4">
                {['native', 'classic', 'strong', 'urgent', 'custom'].map((type) => (
                  <label key={type} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent has-[:checked]:border-indigo-100 has-[:checked]:bg-indigo-50/30 transition-colors">
                    <input 
                      type="radio" 
                      name="alarmType" 
                      value={type} 
                      checked={soundType === type}
                      onChange={(e) => setSoundType(e.target.value)}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-600"
                    />
                    <span className="flex-1 font-medium text-slate-700 capitalize">
                      {type === 'native' && 'Native Alarm Clock Ringtone'}
                      {type === 'classic' && 'Classic Wake'}
                      {type === 'strong' && 'Strong Wake'}
                      {type === 'urgent' && 'Urgent Wake'}
                      {type === 'custom' && 'Custom Sound'}
                    </span>
                  </label>
                ))}
              </div>
              
              {soundType === 'custom' && (
                <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <input 
                    type="file" 
                    accept="audio/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                  <div className="flex flex-col gap-2">
                    {customName && (
                      <p className="text-sm font-medium text-slate-600 truncate flex items-center gap-2">
                        <Music className="w-4 h-4 text-slate-400" />
                        {customName}
                      </p>
                    )}
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-white border border-slate-200 rounded-lg text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Choose Sound From Phone
                    </button>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
                <Volume2 className="w-5 h-5 text-slate-400" />
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">Alarm Volume</span>
                    <span className="text-sm font-bold text-slate-900">{volume}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Vibrate During Alarm</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleVibrationChange(!vibrationEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${vibrationEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${vibrationEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              
              <div className="flex items-center gap-3 mt-6">
                <button 
                  onClick={togglePreview}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition-colors ${
                    isPlaying 
                      ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {isPlaying ? (
                    <><Square className="w-4 h-4" /> Stop</>
                  ) : (
                    <><Play className="w-4 h-4" /> Preview Sound</>
                  )}
                </button>
                <button 
                  onClick={handleSaveSettings}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
                >
                  {isSaving ? 'Saved!' : 'Save Settings'}
                </button>
              </div>
            </div>

            <div className="p-4 flex items-center justify-between border-t border-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Browser Notifications</p>
                  <p className="text-xs text-slate-500">
                    {typeof window !== 'undefined' && 'Notification' in window 
                      ? `Current: ${Notification.permission}`
                      : 'Not supported'}
                  </p>
                </div>
              </div>
              <button 
                onClick={handleRequestNotification}
                className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 cursor-pointer"
              >
                Configure
              </button>
            </div>
            
          </div>
        </div>

        {/* Native Android Alarm Engine & Permissions Status */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1">Native Alarm Reliability</h3>
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm p-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${ReminderService.isNativeAndroid() ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">Execution Layer</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ReminderService.isNativeAndroid() ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {ReminderService.isNativeAndroid() ? 'Native Android' : 'Web Browser'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {ReminderService.isNativeAndroid()
                    ? 'Connected to native Android AlarmManager.setAlarmClock() with boot recovery and full-screen lockscreen capability.'
                    : 'Running in web environment using browser Web Audio & Notification APIs. On Android app builds, native AlarmManager is authoritative.'}
                </p>
              </div>
            </div>

            {ReminderService.isNativeAndroid() && (
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">Exact Alarm Permission (Android 12+)</span>
                  <button
                    onClick={() => ReminderService.openExactAlarmSettings()}
                    className="text-indigo-600 font-bold hover:underline"
                  >
                    Check / Enable
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">Battery Optimization (Doze Mode)</span>
                  <button
                    onClick={() => ReminderService.requestIgnoreBatteryOptimization()}
                    className="text-indigo-600 font-bold hover:underline"
                  >
                    Unrestricted Battery
                  </button>
                </div>
              </div>
            )}

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-start gap-2.5 text-xs text-slate-600">
              <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-slate-800">Device Power Note</p>
                <p className="text-slate-500 leading-relaxed">
                  Alarms ring when the app is closed, in the background, or when the screen is locked, and restore after reboot. Like all third-party apps, alarms require the device to be powered ON.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Phase 5B: Meet Feature Settings (Strictly for adults who have completed setup) */}
        {canUseMeet(user) && user.meetSetupCompleted && (
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 text-sm">Meet People Settings</h3>
                <p className="text-xs text-slate-500">Manage discovery visibility and profile status</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {user.meetEnabled !== false ? (
                  <Eye className="w-4 h-4 text-emerald-600" />
                ) : (
                  <EyeOff className="w-4 h-4 text-slate-400" />
                )}
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Allow Me to Appear in Meet
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {user.meetEnabled !== false 
                      ? 'Visible to other users running tasks' 
                      : 'Hidden from discovery; your alarms work normally'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                id="settings-toggle-meet-btn"
                onClick={async () => {
                  const nextState = user.meetEnabled === false;
                  try {
                    await fetch('/api/meet/toggle-enabled', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        userId: user.id,
                        age: user.age,
                        enabled: nextState
                      })
                    });
                    onUpdateUser({ ...user, meetEnabled: nextState });
                  } catch (e) {
                    console.error('Failed to toggle Meet in settings', e);
                  }
                }}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                  user.meetEnabled !== false ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                }`}
                aria-label="Toggle Meet Visibility"
              >
                <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
              </button>
            </div>
          </div>
        )}
        
        {/* Strategic Placement E: Non-intrusive Settings banner */}
        <AdBanner isPremium={user.subscriptionStatus === 'PREMIUM'} placement="settings" className="my-2" />

        <div className="pt-2">
          <button 
            onClick={onLogout}
            className="w-full bg-white border border-red-100 text-red-600 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
