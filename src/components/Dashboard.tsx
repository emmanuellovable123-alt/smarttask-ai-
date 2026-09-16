import { useState } from 'react';
import { User } from '../types';
import { Home } from './Home';
import { HistoryView } from './HistoryView';
import { ReportsView } from './ReportsView';
import { UpgradeView } from './UpgradeView';
import { SettingsView } from './SettingsView';
import { ReminderManager } from './ReminderManager';
import { Home as HomeIcon, Clock, BarChart3, Shield, Settings } from 'lucide-react';
import { simulateTime, setSimulateTo9PM } from '../lib/dateUtils';

export function Dashboard({ user, onLogout, onUpdateUser }: { user: User, onLogout: () => void, onUpdateUser: (u: User) => void }) {
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'reports' | 'upgrade' | 'settings'>('home');
  const [refreshKey, setRefreshKey] = useState(0);

  const forceRefresh = () => setRefreshKey(prev => prev + 1);

  const isNotificationsDenied = typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied';

  return (
    <div className="flex-1 flex flex-col h-full relative">
      <ReminderManager userId={user.id} onTasksUpdated={forceRefresh} />
      
      {/* Dev Tools Panel */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="absolute top-0 right-0 z-50 bg-red-100 p-2 text-xs rounded-bl-lg shadow flex flex-col gap-1 border border-red-200">
          <span className="font-bold text-red-800 text-[10px] uppercase">Test Mode</span>
          <button onClick={() => { simulateTime(60 * 1000); forceRefresh(); }} className="bg-white px-2 py-1 rounded text-red-700 hover:bg-red-50">+1 Min</button>
          <button onClick={() => { setSimulateTo9PM(); forceRefresh(); }} className="bg-white px-2 py-1 rounded text-red-700 hover:bg-red-50">Go to 9 PM</button>
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'home' && <div key={`home-${refreshKey}`} className="contents"><Home user={user} onLogout={onLogout} /></div>}
        {activeTab === 'history' && <div key={`history-${refreshKey}`} className="contents"><HistoryView user={user} /></div>}
        {activeTab === 'reports' && <div key={`reports-${refreshKey}`} className="contents"><ReportsView user={user} /></div>}
        {activeTab === 'settings' && <div key={`settings-${refreshKey}`} className="contents"><SettingsView user={user} onLogout={onLogout} onUpdateUser={onUpdateUser} /></div>}
        {activeTab === 'upgrade' && (
          <UpgradeView 
            user={user} 
            onUpgradeSuccess={() => window.location.reload()} 
            onClose={() => setActiveTab('home')} 
          />
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="bg-white border-t border-slate-200 px-4 py-3 flex justify-between items-center pb-safe">
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1 flex-1 ${activeTab === 'home' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <HomeIcon className="w-6 h-6" />
          <span className="text-[10px] font-bold">Home</span>
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center gap-1 flex-1 ${activeTab === 'history' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Clock className="w-6 h-6" />
          <span className="text-[10px] font-bold">History</span>
        </button>
        <button 
          onClick={() => setActiveTab('reports')}
          className={`flex flex-col items-center gap-1 flex-1 ${activeTab === 'reports' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <BarChart3 className="w-6 h-6" />
          <span className="text-[10px] font-bold">Reports</span>
        </button>
        <button 
          onClick={() => setActiveTab('upgrade')}
          className={`flex flex-col items-center gap-1 flex-1 ${activeTab === 'upgrade' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Shield className="w-6 h-6" />
          <span className="text-[10px] font-bold">Premium</span>
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 flex-1 ${activeTab === 'settings' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Settings className="w-6 h-6" />
          <span className="text-[10px] font-bold">Settings</span>
        </button>
      </div>
    </div>
  );
}
