import { User } from '../types';
import { useTasks } from '../lib/TaskContext';
import { CheckCircle2, Circle, XCircle, Ban } from 'lucide-react';

export function HistoryView({ user }: { user: User }) {
  const { tasks } = useTasks();
  const sortedTasks = [...tasks].sort((a, b) => b.createdTimestamp - a.createdTimestamp);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 bg-slate-50">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Task History</h2>
      
      {sortedTasks.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200">
          <p className="text-slate-500">No task history found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedTasks.map(task => (
            <div 
              key={task.id} 
              className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3"
            >
              <div className="mt-0.5 flex-shrink-0">
                {task.status === 'Fulfilled' && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                {task.status === 'Pending' && <Circle className="w-6 h-6 text-slate-300" />}
                {task.status === 'Not Fulfilled' && <XCircle className="w-6 h-6 text-red-500" />}
                {task.status === 'Cancelled' && <Ban className="w-6 h-6 text-slate-400" />}
              </div>
              <div className="flex-1">
                <p className={`font-semibold ${task.status === 'Fulfilled' || task.status === 'Cancelled' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                  {task.taskText}
                </p>
                <div className="flex gap-2 mt-1 text-sm text-slate-500 font-medium">
                  <span className="bg-slate-100 px-2 py-0.5 rounded-md text-xs">{task.scheduledDate}</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded-md text-xs">{task.scheduledTime || 'No time'}</span>
                </div>
              </div>
              <div className="flex-shrink-0">
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  task.status === 'Fulfilled' ? 'bg-green-100 text-green-700' : 
                  task.status === 'Not Fulfilled' ? 'bg-red-100 text-red-700' : 
                  task.status === 'Cancelled' ? 'bg-slate-100 text-slate-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {task.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
