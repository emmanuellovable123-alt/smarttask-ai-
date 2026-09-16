import React, { useState } from 'react';
import { Screen } from '../App';
import { User } from '../types';
import { store } from '../lib/store';
import { supabase, hasSupabaseKeys } from '../lib/supabase';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onNavigate: (screen: Screen) => void;
  onLogin: (user: User) => void;
}

export function Login({ onNavigate, onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setIsLoading(true);

    try {
      if (!hasSupabaseKeys) {
        throw new Error("No Supabase keys");
      }

      // 1. Supabase Auth Sign In
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      const userId = authData.user?.id;
      if (!userId) throw new Error('User login failed');

      // 2. Fetch Profile Data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      const user: User = {
        id: userId,
        name: profileData.name,
        email: profileData.email,
        country: profileData.country,
        age: profileData.age,
        subscriptionStatus: profileData.subscription_status,
        timezone: profileData.timezone,
        alarmSoundType: profileData.alarm_sound_type,
        alarmVolume: profileData.alarm_volume
      };

      store.setCurrentUser(user); // fallback storage
      onLogin(user);

    } catch (err: any) {
      if (hasSupabaseKeys) {
        console.error("Login fallback:", err);
      }
      
      // Fallback for test mode if Supabase fails
      const users = store.getUsers();
      const user = users.find(u => u.email === email);

      if (user && user.subscriptionStatus === password) { // Mock fallback
        store.setCurrentUser(user);
        onLogin(user);
      } else {
        setError('Invalid email or password.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex-1 flex flex-col p-6 overflow-y-auto"
    >
      <div className="flex-1 flex flex-col justify-center">
        <div className="flex justify-center mb-8">
          <div className="bg-blue-100 p-3 rounded-2xl">
            <CheckCircle2 className="w-10 h-10 text-blue-600" />
          </div>
        </div>
        
        <h2 className="text-3xl font-bold text-center text-slate-900 mb-2">Welcome Back</h2>
        <p className="text-slate-500 text-center mb-8">Sign in to continue to Daily TASK AI</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="email">Email Address</label>
            <input 
              id="email"
              type="email" 
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="password">Password</label>
            <input 
              id="password"
              type="password" 
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all mt-4 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-slate-500">Don't have an account?</p>
          <button 
            onClick={() => onNavigate('register')}
            className="text-blue-600 font-semibold mt-1 hover:underline outline-none"
          >
            Create an Account
          </button>
        </div>
      </div>
    </motion.div>
  );
}
