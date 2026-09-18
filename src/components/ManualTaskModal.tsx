import { useState, useEffect } from 'react';
import { User, Task } from '../types';
import { useTasks } from '../lib/TaskContext';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { getUserTimezone } from '../lib/dateUtils';
import { parseMultiTaskFallback } from '../lib/taskParsingEngine';

export function ManualTaskModal({ user, editTask, onClose, onSaved }: { user: User, editTask?: Task, onClose: () => void, onSaved: () => void }) {
  const { saveTask, updateTask } = useTasks();
  const [taskText, setTaskText] = useState(editTask?.taskText || '');
  const [date, setDate] = useState(editTask?.scheduledDate || 'Today');
  const [time, setTime] = useState(editTask?.scheduledTime || '');

  useEffect(() => {
    if (editTask) {
      setTaskText(editTask.taskText);
      setDate(editTask.scheduledDate);
      setTime(editTask.scheduledTime);
    }
  }, [editTask]);

  // If user enters natural language like "Go to the gym at 6 PM today", auto-extract date and time on blur
  const handleTaskBlur = () => {
    if (!editTask && taskText.trim()) {
      const parsed = parseMultiTaskFallback(taskText);
      if (parsed.success && parsed.tasks.length > 0) {
        const first = parsed.tasks[0];
        if (first.task && first.task !== taskText) {
          setTaskText(first.task);
          if (first.date && (!date || date === 'Today')) {
            setDate(first.date);
          }
          if (first.time && !time) {
            // Convert e.g. "6:00 PM" to "18:00" for standard time input if applicable
            const m = first.time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
            if (m) {
              let h = parseInt(m[1], 10);
              const min = m[2];
              const ampm = m[3].toUpperCase();
              if (ampm === 'PM' && h < 12) h += 12;
              if (ampm === 'AM' && h === 12) h = 0;
              setTime(`${String(h).padStart(2, '0')}:${min}`);
            } else {
              setTime(first.time);
            }
          }
        }
      }
    }
  };

  const handleSave = async () => {
    if (!taskText) return;

    try {
      // Run the same parsing engine on typed text to extract any embedded date/time
      let finalTaskText = taskText.trim();
      let finalDate = date;
      let finalTime = time;
      let recurrenceRule: string | undefined = undefined;

      if (!editTask) {
        const parsed = parseMultiTaskFallback(taskText);
        if (parsed.success && parsed.tasks.length > 0) {
          const first = parsed.tasks[0];
          if (first.task) finalTaskText = first.task;
          if (!finalTime && first.time) finalTime = first.time;
          if ((!finalDate || finalDate === 'Today') && first.date) finalDate = first.date;
          if (first.recurrenceRule) recurrenceRule = first.recurrenceRule;
        }
      }

      if (editTask) {
        const updatedTask: Task = {
          ...editTask,
          taskText: finalTaskText,
          scheduledDate: finalDate,
          scheduledTime: finalTime,
          timezone: getUserTimezone(),
          snoozedUntil: null, // Reset snooze if edited
        };
        
        // Reset triggering state
        const previouslyTriggeredStr = localStorage.getItem(`triggered_reminders_${user.id}`) || '[]';
        let previouslyTriggered: string[] = JSON.parse(previouslyTriggeredStr);
        previouslyTriggered = previouslyTriggered.filter(id => id !== editTask.id);
        localStorage.setItem(`triggered_reminders_${user.id}`, JSON.stringify(previouslyTriggered));

        await updateTask(updatedTask);
      } else {
        const newTask: Task = {
          id: crypto.randomUUID(),
          userId: user.id,
          taskText: finalTaskText,
          scheduledDate: finalDate,
          scheduledTime: finalTime,
          timezone: getUserTimezone(),
          recurrenceRule,
          status: 'Pending',
          createdTimestamp: Date.now(),
          completedTimestamp: null,
        };
        await saveTask(newTask);
      }
      
      await onSaved();
    } catch (err) {
      console.error('Failed to save task:', err);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-t-3xl p-6 relative z-10 shadow-2xl"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-900">{editTask ? '✏️ Edit Task' : '✏️ Type a Task'}</h3>
            <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-slate-900">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Task</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                placeholder="What do you want to accomplish?"
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
                onBlur={handleTaskBlur}
                autoFocus
              />
            </div>
            
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date</label>
                <select 
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                >
                  <option value="Today">Today</option>
                  <option value="Tomorrow">Tomorrow</option>
                  <option value="Next Week">Next Week</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Time</label>
                <input 
                  type="time" 
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>

            <button 
              onClick={handleSave}
              disabled={!taskText}
              className="w-full bg-slate-900 text-white font-semibold py-3.5 rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {editTask ? 'Save Changes' : 'Set Reminder'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
