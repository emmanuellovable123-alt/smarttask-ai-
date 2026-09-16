import React, { useState, useEffect } from 'react';
import { User, Task } from '../types';
import { useTasks } from '../lib/TaskContext';
import { useAdManager } from '../lib/AdContext';
import { Mic, PenSquare, LogOut, CheckCircle2, Circle, MoreVertical, Trash, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ManualTaskModal } from './ManualTaskModal';
import { VoiceTaskModal } from './VoiceTaskModal';
import { parseTaskDateTime, getNow } from '../lib/dateUtils';

export function Home({ user, onLogout }: { user: User, onLogout: () => void }) {
  const { tasks, updateTask, saveTask } = useTasks();
  const { showAd } = useAdManager();
  
  const [displayedTasks, setDisplayedTasks] = useState<Task[]>([]);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  
  const [now, setNow] = useState(getNow());

  useEffect(() => {
    const todayTasks = tasks.filter(t => t.status === 'Pending' || t.status === 'Fulfilled' || t.status === 'Not Fulfilled');
    setDisplayedTasks(todayTasks);
    
    const timer = setInterval(() => setNow(getNow()), 60000); // update every minute for overdue check
    return () => clearInterval(timer);
  }, [tasks]);

  const toggleTaskStatus = async (task: Task) => {
    try {
      const newStatus = task.status === 'Fulfilled' ? 'Pending' : 'Fulfilled';
      const updated = { ...task, status: newStatus, completedTimestamp: newStatus === 'Fulfilled' ? getNow() : null };
      await updateTask(updated as Task);
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  const handleDelete = async (task: Task) => {
    if (confirm("Are you sure you want to remove this task?")) {
      try {
        const updated = { ...task, status: 'Cancelled' };
        await updateTask(updated as Task);
      } catch (err) {
        console.error('Error deleting task:', err);
      }
    }
  };

  const scheduleTestReminder = async () => {
    try {
      const nowMs = Date.now();
      const testDate = new Date(nowMs + 60000); // 1 minute from now
      
      const hh = String(testDate.getHours()).padStart(2, '0');
      const mm = String(testDate.getMinutes()).padStart(2, '0');
      const timeStr = `${hh}:${mm}`;
      
      const yyyy = testDate.getFullYear();
      const M = String(testDate.getMonth() + 1).padStart(2, '0');
      const d = String(testDate.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${M}-${d}`;
      
      const newTask = {
        id: crypto.randomUUID(),
        userId: user.id,
        taskText: "Test Reminder (1 min)",
        status: 'Pending',
        scheduledTime: timeStr,
        scheduledDate: dateStr,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        createdTimestamp: Date.now()
      };
      
      await saveTask(newTask as any);
    } catch (err) {
      console.error('Error creating test task:', err);
    }
  };

  const handleTaskSaved = async () => {
    try {
      setShowManualModal(false);
      setShowVoiceModal(false);
      setEditingTask(null);

      // After task is successfully saved, show configured ad for free users (Task Ad Flow)
      if (user.subscriptionStatus !== 'PREMIUM') {
         await showAd('interstitial');
      }
    } catch (err) {
      console.error('Error handling task saved:', err);
    }
  };
  
  // Grouping logic
  const morningTasks: Task[] = [];
  const afternoonTasks: Task[] = [];
  const eveningTasks: Task[] = [];
  
  displayedTasks.forEach(task => {
    const timeMs = parseTaskDateTime(task.scheduledDate, task.scheduledTime);
    if (!timeMs) {
      morningTasks.push(task); // Default to morning if no time
      return;
    }
    const d = new Date(timeMs);
    const hour = d.getHours();
    
    if (hour < 12) {
      morningTasks.push(task);
    } else if (hour < 17) {
      afternoonTasks.push(task);
    } else {
      eveningTasks.push(task);
    }
  });
  
  const sortTasks = (a: Task, b: Task) => {
    const timeA = parseTaskDateTime(a.scheduledDate, a.scheduledTime) || 0;
    const timeB = parseTaskDateTime(b.scheduledDate, b.scheduledTime) || 0;
    return timeA - timeB;
  };
  
  morningTasks.sort(sortTasks);
  afternoonTasks.sort(sortTasks);
  eveningTasks.sort(sortTasks);

  const TaskItem: React.FC<{ task: Task }> = ({ task }) => {
    const timeMs = parseTaskDateTime(task.scheduledDate, task.scheduledTime);
    const isOverdue = timeMs && timeMs < now && task.status !== 'Fulfilled';
    
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3 relative"
      >
        <button onClick={() => toggleTaskStatus(task)} className="mt-0.5 flex-shrink-0 focus:outline-none">
          {task.status === 'Fulfilled' ? (
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          ) : (
            <Circle className="w-6 h-6 text-slate-300" />
          )}
        </button>
        <div className="flex-1 pr-6">
          <p className={`font-semibold ${task.status === 'Fulfilled' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
            {task.taskText}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-sm font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{task.scheduledTime || 'No time'}</span>
            {isOverdue && (
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                OVERDUE
              </span>
            )}
            {task.status === 'Fulfilled' && (
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md">Fulfilled</span>
            )}
          </div>
        </div>
        
        <div className="absolute top-3 right-2">
          <button onClick={() => setOpenMenuId(openMenuId === task.id ? null : task.id)} className="p-1 text-slate-400 hover:text-slate-700">
            <MoreVertical className="w-5 h-5" />
          </button>
          <AnimatePresence>
            {openMenuId === task.id && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 mt-1 w-36 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-10"
              >
                <button 
                  onClick={() => { setEditingTask(task); setOpenMenuId(null); }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
                <button 
                  onClick={() => { handleDelete(task); setOpenMenuId(null); }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash className="w-4 h-4" /> Delete
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 relative h-full">
      {/* Header */}
      <div className="bg-white px-6 pt-8 pb-6 border-b border-slate-100 flex justify-between items-start flex-shrink-0">
        <div>
          <p className="text-slate-500 font-medium mb-1">Welcome, {user.name} 👋</p>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">
            What do you want to<br/>accomplish today?
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-40">
        <div className="flex flex-col gap-3 mb-8">
          <button 
            onClick={() => setShowVoiceModal(true)}
            className="w-full bg-blue-600 text-white rounded-2xl py-4 px-4 flex items-center justify-center gap-3 font-bold text-lg shadow-lg shadow-blue-600/30 hover:bg-blue-700 active:scale-[0.98] transition-all"
          >
            <Mic className="w-7 h-7" />
            Tap to Speak Task
          </button>
          
          <button 
            onClick={() => setShowManualModal(true)}
            className="w-full bg-white text-slate-700 border border-slate-200 rounded-2xl py-3.5 px-4 flex items-center justify-center gap-2 font-semibold hover:bg-slate-50 active:scale-[0.98] transition-all shadow-sm"
          >
            <PenSquare className="w-5 h-5 text-slate-400" />
            Type Task
          </button>
        </div>
        
        {displayedTasks.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-2">No tasks yet.</h3>
            <p className="text-slate-500 mb-6">What's the first thing you want to accomplish today?</p>
            <button 
              onClick={() => setShowVoiceModal(true)}
              className="mx-auto bg-blue-100 text-blue-700 rounded-xl py-2.5 px-5 flex items-center justify-center gap-2 font-bold text-sm hover:bg-blue-200 transition-colors"
            >
              <Mic className="w-4 h-4" />
              Speak a Task
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {morningTasks.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1">Good Morning</h3>
                <div className="space-y-3">
                  {morningTasks.map(task => <TaskItem key={task.id} task={task} />)}
                </div>
              </div>
            )}
            
            {afternoonTasks.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1">Afternoon</h3>
                <div className="space-y-3">
                  {afternoonTasks.map(task => <TaskItem key={task.id} task={task} />)}
                </div>
              </div>
            )}
            
            {eveningTasks.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1">Evening</h3>
                <div className="space-y-3">
                  {eveningTasks.map(task => <TaskItem key={task.id} task={task} />)}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <button
            onClick={scheduleTestReminder}
            className="text-xs text-slate-400 underline hover:text-slate-600 transition-colors"
          >
            Test Reminder (Dev Only)
          </button>
        </div>
      </div>

      {(showManualModal || editingTask) && (
        <ManualTaskModal 
          user={user}
          editTask={editingTask || undefined}
          onClose={() => {
            setShowManualModal(false);
            setEditingTask(null);
          }} 
          onSaved={handleTaskSaved} 
        />
      )}

      {showVoiceModal && (
        <VoiceTaskModal 
          user={user} 
          onClose={() => setShowVoiceModal(false)} 
          onSaved={handleTaskSaved} 
        />
      )}
    </div>
  );
}
