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
import { useAdManager } from '../lib/AdContext';
import { adAnalytics } from '../lib/adAnalytics';
import { useTasks } from '../lib/TaskContext';
import { MeetTestSuiteModal } from './meet/MeetTestSuiteModal';

export function Dashboard({ user, onLogout, onUpdateUser }: { user: User, onLogout: () => void, onUpdateUser: (u: User) => void }) {
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'reports' | 'upgrade' | 'settings'>('home');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showTestSuite, setShowTestSuite] = useState(false);
  const { simulateNextAdFailure, setSimulateNextAdFailure } = useAdManager();
  const { saveTask } = useTasks();

  const forceRefresh = () => setRefreshKey(prev => prev + 1);

  const isNotificationsDenied = typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied';

  const switchTestScenario = async (scenario: 'A' | 'B' | 'C' | 'D' | 'E') => {
    try {
      const res = await fetch(`/api/meet/test-scenarios?scenario=${scenario}`);
      if (res.ok) {
        const scenarioUser = await res.json();
        onUpdateUser(scenarioUser);
        forceRefresh();
      }
    } catch (err) {
      console.error('Failed to switch test scenario:', err);
    }
  };

  const toggleSubscription = () => {
    const nextStatus = user.subscriptionStatus === 'PREMIUM' ? 'FREE' : 'PREMIUM';
    onUpdateUser({
      ...user,
      subscriptionStatus: nextStatus
    });
    forceRefresh();
  };

  const triggerInstantAlarm = async () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const yyyy = now.getFullYear();
    const M = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');

    await saveTask({
      id: crypto.randomUUID(),
      userId: user.id,
      taskText: 'Instant Alarm Test (Stop Ringing Ad Check)',
      status: 'Pending',
      scheduledDate: `${yyyy}-${M}-${d}`,
      scheduledTime: `${hh}:${mm}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      createdTimestamp: Date.now() - 5000
    });
    forceRefresh();
  };

  return (
    <div className="flex-1 flex flex-col h-full relative">
      <ReminderManager userId={user.id} onTasksUpdated={forceRefresh} />
      
      {/* Dev Tools Panel */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="absolute top-0 right-0 z-50 bg-red-100 p-2 text-xs rounded-bl-lg shadow flex flex-col gap-1 border border-red-200 max-w-[130px]">
          <span className="font-bold text-red-800 text-[10px] uppercase">Test Mode</span>
          <button onClick={() => { simulateTime(60 * 1000); forceRefresh(); }} className="bg-white px-2 py-0.5 rounded text-red-700 hover:bg-red-50 text-[10px]">+1 Min</button>
          <button onClick={() => { setSimulateTo9PM(); forceRefresh(); }} className="bg-white px-2 py-0.5 rounded text-red-700 hover:bg-red-50 text-[10px]">Go to 9 PM</button>
          <div className="border-t border-red-200 pt-1 mt-0.5">
            <span className="font-semibold text-slate-700 text-[9px] block mb-0.5">Phase 5B Scenarios:</span>
            <div className="grid grid-cols-2 gap-1">
              <button onClick={() => switchTestScenario('A')} title="User A: Under 18" className="bg-white px-1 py-0.5 rounded text-slate-700 text-[9px] hover:bg-slate-50">User A</button>
              <button onClick={() => switchTestScenario('B')} title="User B: 18+ No Setup" className="bg-white px-1 py-0.5 rounded text-slate-700 text-[9px] hover:bg-slate-50">User B</button>
              <button onClick={() => switchTestScenario('C')} title="User C: 18+ No Phone Verify" className="bg-white px-1 py-0.5 rounded text-slate-700 text-[9px] hover:bg-slate-50">User C</button>
              <button onClick={() => switchTestScenario('D')} title="User D: 18+ Missing Info" className="bg-white px-1 py-0.5 rounded text-slate-700 text-[9px] hover:bg-slate-50">User D</button>
              <button onClick={() => switchTestScenario('E')} title="User E: 18+ Complete Setup" className="bg-white px-1 py-0.5 rounded text-blue-700 font-bold text-[9px] hover:bg-blue-50 col-span-2">User E (Ready)</button>
            </div>
          </div>
          <div className="border-t border-red-200 pt-1 mt-0.5">
            <span className="font-semibold text-slate-700 text-[9px] block mb-0.5">Phase 6 Ad Tests:</span>
            <div className="flex flex-col gap-1">
              <button 
                onClick={toggleSubscription} 
                className="bg-white px-1.5 py-0.5 rounded text-slate-800 text-[9px] hover:bg-slate-50 font-medium"
              >
                Plan: <span className={user.subscriptionStatus === 'PREMIUM' ? 'text-amber-600 font-bold' : 'text-blue-600 font-bold'}>{user.subscriptionStatus || 'FREE'}</span>
              </button>
              <button 
                onClick={triggerInstantAlarm} 
                className="bg-white px-1.5 py-0.5 rounded text-rose-700 text-[9px] hover:bg-rose-50 font-bold"
              >
                Ring Alarm Now
              </button>
              <button 
                onClick={() => setSimulateNextAdFailure(!simulateNextAdFailure)} 
                className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${simulateNextAdFailure ? 'bg-amber-200 text-amber-900 font-bold' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                Sim Ad Fail: {simulateNextAdFailure ? 'ON' : 'OFF'}
              </button>
              <button 
                onClick={() => {
                  const evts = adAnalytics.getEvents();
                  alert(`Ad Events (${evts.length}):\n` + evts.slice(-8).map(e => `• ${e.eventName}`).join('\n'));
                }} 
                className="bg-white px-1.5 py-0.5 rounded text-slate-700 text-[9px] hover:bg-slate-50"
              >
                Ad Logs ({adAnalytics.getEvents().length})
              </button>
              <button 
                id="open-30-tests-btn"
                onClick={() => setShowTestSuite(true)} 
                className="bg-blue-600 px-1.5 py-0.5 rounded text-white text-[9px] hover:bg-blue-700 font-bold"
              >
                Run 30 Tests
              </button>
            </div>
          </div>
        </div>
      )}

      {showTestSuite && (
        <MeetTestSuiteModal onClose={() => setShowTestSuite(false)} />
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'home' && <div key={`home-${refreshKey}`} className="contents"><Home user={user} onLogout={onLogout} onUpdateUser={onUpdateUser} /></div>}
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
