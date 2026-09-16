import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { LogOut, Bell, CalendarClock, Volume2, Music, Upload, Play, Square } from 'lucide-react';
import { supabase, hasSupabaseKeys } from '../lib/supabase';
import { saveCustomAudio, getCustomAudioName, playAlarmSound, stopAudio } from '../lib/audioManager';

export function SettingsView({ user, onLogout, onUpdateUser }: { user: User, onLogout: () => void, onUpdateUser: (u: User) => void }) {
  const [soundType, setSoundType] = useState(user.alarmSoundType || 'strong');
  const [volume, setVolume] = useState(user.alarmVolume ?? 75);
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
        await playAlarmSound(soundType as any, volume);
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

  const handleSaveSettings = async () => {
    setIsSaving(true);
    const updatedUser = {
      ...user,
      alarmSoundType: soundType as any,
      alarmVolume: volume
    };
    
    // Save to App state and localStorage
    onUpdateUser(updatedUser);
    
    // Attempt Supabase save
    if (hasSupabaseKeys) {
      try {
        // Only sending standard fields to avoid breaking if alarm columns missing in DB
        // since we don't have schema guarantees for the new columns in Supabase
        await supabase.from('profiles').update({
           alarm_sound_type: soundType,
           alarm_volume: volume
        }).eq('id', user.id);
      } catch (err) {
        // Ignore DB update errors since it's saved locally
      }
    }
    
    setTimeout(() => setIsSaving(false), 500);
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
                {['classic', 'strong', 'urgent', 'custom'].map((type) => (
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
                className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100"
              >
                Configure
              </button>
            </div>
            
          </div>
        </div>
        
        <button 
          onClick={onLogout}
          className="w-full bg-white border border-red-100 text-red-600 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-50"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
