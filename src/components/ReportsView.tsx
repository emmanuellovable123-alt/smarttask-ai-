import { useState, useMemo } from 'react';
import { User, Task } from '../types';
import { useTasks } from '../lib/TaskContext';
import { parseTaskDateTime } from '../lib/dateUtils';
import { CheckCircle2, XCircle, Calendar, Flame } from 'lucide-react';
import { AdBanner } from './AdBanner';

export function ReportsView({ user }: { user: User }) {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const { tasks } = useTasks();

  const { reportsByDate, currentStreak, highestStreak } = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    const dateStrings: string[] = [];
    
    tasks.forEach(task => {
      if (task.status === 'Cancelled') return;

      const targetMs = parseTaskDateTime(task.scheduledDate, task.scheduledTime) || task.createdTimestamp;
      const dateObj = new Date(targetMs);
      const yyyy = dateObj.getFullYear();
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const isoDate = `${yyyy}-${mm}-${dd}`; // For sorting
      const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
        dateStrings.push(isoDate); // To calculate streak correctly
      }
      grouped[dateStr].push(task);
    });
    
    // Calculate streak
    let curr = 0;
    let high = 0;
    
    // Get unique sorted dates (newest first)
    const sortedDates = [...new Set(dateStrings)].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    let lastDateObj: Date | null = null;
    
    for (const isoDate of sortedDates) {
      const dateObj = new Date(isoDate);
      const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      
      const dayTasks = grouped[dateStr];
      const hasCompleted = dayTasks.some(t => t.status === 'Fulfilled');
      
      if (hasCompleted) {
        if (!lastDateObj) {
          curr = 1;
        } else {
          // Check if it's consecutive
          const diffTime = Math.abs(lastDateObj.getTime() - dateObj.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          
          if (diffDays <= 1) { // Allowing 1 day diff
             curr++;
          } else {
             break; // streak broken
          }
        }
        lastDateObj = dateObj;
        if (curr > high) high = curr;
      } else {
        break; // A day with tasks but none completed breaks the streak
      }
    }

    return { reportsByDate: grouped, currentStreak: curr, highestStreak: high };
  }, [tasks]);

  const dates = Object.keys(reportsByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  
  const activeDate = selectedDate || (dates.length > 0 ? dates[0] : '');
  const activeTasks = reportsByDate[activeDate] || [];

  const fulfilledTasks = activeTasks.filter(t => t.status === 'Fulfilled');
  const notFulfilledTasks = activeTasks.filter(t => t.status === 'Not Fulfilled' || t.status === 'Pending');

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
      <div className="bg-white px-6 pt-8 pb-4 border-b border-slate-100 flex-shrink-0">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-slate-900">Daily Reports</h2>
          
          {currentStreak > 0 && (
            <div className="flex items-center gap-1.5 bg-orange-50 text-orange-600 px-3 py-1.5 rounded-full shadow-sm">
              <Flame className="w-4 h-4 fill-orange-500" />
              <span className="font-bold text-sm">{currentStreak} Day Streak!</span>
            </div>
          )}
        </div>
        
        {dates.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {dates.map(date => (
              <button 
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 ${
                  activeDate === date ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Calendar className="w-4 h-4" />
                {date}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {dates.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-500">No reports available yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Summary</h3>
              <p className="text-2xl font-bold text-slate-900">
                You completed {fulfilledTasks.length} of {activeTasks.length} tasks.
              </p>
            </div>

            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 mb-3">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
                Tasks Fulfilled
              </h3>
              {fulfilledTasks.length === 0 ? (
                <p className="text-slate-500 italic text-sm">No tasks fulfilled.</p>
              ) : (
                <ul className="space-y-2">
                  {fulfilledTasks.map(task => (
                    <li key={task.id} className="bg-green-50/50 p-3 rounded-xl border border-green-100 flex justify-between items-center">
                      <span className="font-semibold text-slate-800">{task.taskText}</span>
                      <span className="text-sm text-slate-500 font-medium">{task.scheduledTime}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 mb-3">
                <XCircle className="w-6 h-6 text-red-500" />
                Tasks Not Fulfilled
              </h3>
              {notFulfilledTasks.length === 0 ? (
                <p className="text-slate-500 italic text-sm">All tasks fulfilled!</p>
              ) : (
                <ul className="space-y-2">
                  {notFulfilledTasks.map(task => (
                    <li key={task.id} className="bg-red-50/50 p-3 rounded-xl border border-red-100 flex justify-between items-center">
                      <span className="font-semibold text-slate-800">{task.taskText}</span>
                      <span className="text-sm text-slate-500 font-medium">{task.scheduledTime}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Strategic Placement C: Daily report banner below content */}
        <AdBanner isPremium={user.subscriptionStatus === 'PREMIUM'} placement="reports" className="mt-8 mb-4" />
      </div>
    </div>
  );
}
