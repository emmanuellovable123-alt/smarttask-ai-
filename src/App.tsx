/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { User } from './types';
import { store } from './lib/store';
import { Splash } from './components/Splash';
import { Register } from './components/Register';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { AdProvider } from './lib/AdContext';
import { TaskProvider } from './lib/TaskContext';
import { ErrorBoundary } from './components/ErrorBoundary';

import { supabase, hasSupabaseKeys } from './lib/supabase';

export type Screen = 'splash' | 'register' | 'login' | 'dashboard';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check if user is logged in
    const currentUser = store.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
    
    // Auto-proceed from splash after 3 seconds
    const timer = setTimeout(() => {
      if (currentUser) {
        setCurrentScreen('dashboard');
      } else {
        setCurrentScreen('login');
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const handleLogin = (user: User) => {
    setUser(user);
    store.setCurrentUser(user);
    setCurrentScreen('dashboard');
  };

  const handleLogout = async () => {
    try {
      if (hasSupabaseKeys) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
    setUser(null);
    store.setCurrentUser(null);
    setCurrentScreen('login');
  };

  const handleUpdateUser = async (updatedUser: User) => {
    try {
      setUser(updatedUser);
      store.setCurrentUser(updatedUser);
      store.updateUser(updatedUser);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <ErrorBoundary>
      <AdProvider>
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
          <main className="max-w-md mx-auto h-screen bg-white shadow-xl overflow-hidden relative border-x border-slate-100 flex flex-col">
            {currentScreen === 'splash' && <Splash />}
            {currentScreen === 'register' && <Register onNavigate={(screen) => setCurrentScreen(screen)} onLogin={handleLogin} />}
            {currentScreen === 'login' && <Login onNavigate={(screen) => setCurrentScreen(screen)} onLogin={handleLogin} />}
            {currentScreen === 'dashboard' && user && (
              <TaskProvider user={user}>
                <Dashboard user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />
              </TaskProvider>
            )}
          </main>
        </div>
      </AdProvider>
    </ErrorBoundary>
  );
}

