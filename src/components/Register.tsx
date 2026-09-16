import React, { useState } from 'react';
import { Screen } from '../App';
import { User } from '../types';
import { store } from '../lib/store';
import { supabase, hasSupabaseKeys } from '../lib/supabase';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface RegisterProps {
  onNavigate: (screen: Screen) => void;
  onLogin: (user: User) => void;
}

export function Register({ onNavigate, onLogin }: RegisterProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    country: '',
    age: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const { name, email, country, age, password } = formData;

    if (!name || !email || !country || !age || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setIsLoading(true);

    try {
      if (!hasSupabaseKeys) {
        throw new Error("No Supabase keys");
      }

      // 1. Supabase Auth Sign Up
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      const userId = authData.user?.id;
      if (!userId) throw new Error('User creation failed');

      // 2. Insert Profile Data
      const { error: profileError } = await supabase.from('profiles').insert({
        id: userId,
        name,
        email,
        country,
        age,
        subscription_status: 'FREE',
        alarm_sound_type: 'strong',
        alarm_volume: 75
      });

      if (profileError) throw profileError;

      const newUser: User = {
        id: userId,
        name,
        email,
        country,
        age,
        subscriptionStatus: 'FREE',
        alarmSoundType: 'strong',
        alarmVolume: 75
      };

      store.saveUser(newUser); // keep local as fallback
      onLogin(newUser);
      
    } catch (err: any) {
      if (hasSupabaseKeys) {
        console.error("Registration fallback:", err);
      }
      
      // Fallback for test mode if Supabase fails (e.g. no real keys)
      const users = store.getUsers();
      if (users.find(u => u.email === email)) {
        setError('Email already exists (local).');
        setIsLoading(false);
        return;
      }
  
      const newUser: User = {
        id: crypto.randomUUID(),
        name,
        email,
        country,
        age,
        subscriptionStatus: 'FREE',
        alarmSoundType: 'strong',
        alarmVolume: 75
      };
  
      store.saveUser(newUser);
      onLogin(newUser);
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
      <div className="flex-1 flex flex-col pt-8 pb-4">
        <div className="flex mb-6">
          <div className="bg-blue-100 p-2.5 rounded-xl">
            <CheckCircle2 className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Create Account</h2>
        <p className="text-slate-500 mb-8">Join Daily TASK AI to get things done.</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="name">Full Name</label>
            <input 
              id="name"
              type="text" 
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              placeholder="John Doe"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="email">Email Address</label>
            <input 
              id="email"
              type="email" 
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="country">Country</label>
              <input 
                id="country"
                type="text" 
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                placeholder="e.g. US"
                value={formData.country}
                onChange={(e) => setFormData({...formData, country: e.target.value})}
              />
            </div>
            <div className="w-1/3">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="age">Age</label>
              <input 
                id="age"
                type="number" 
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                placeholder="25"
                value={formData.age}
                onChange={(e) => setFormData({...formData, age: e.target.value})}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="password">Password</label>
            <input 
              id="password"
              type="password" 
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all mt-4 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
            {isLoading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-8 text-center pb-4">
          <p className="text-slate-500">Already have an account?</p>
          <button 
            onClick={() => onNavigate('login')}
            className="text-blue-600 font-semibold mt-1 hover:underline outline-none"
          >
            Sign in
          </button>
        </div>
      </div>
    </motion.div>
  );
}
