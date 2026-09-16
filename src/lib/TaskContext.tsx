import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Task, User } from '../types';
import { supabase, hasSupabaseKeys } from './supabase';

interface TaskContextType {
  tasks: Task[];
  loading: boolean;
  refreshTasks: () => Promise<void>;
  saveTask: (task: Task) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ user, children }: { user: User; children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshTasks = async () => {
    try {
      if (hasSupabaseKeys) {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user.id);
          
        if (error) throw error;

        if (data) {
          const parsed = data.map(dbTask => ({
            id: dbTask.id,
            userId: dbTask.user_id,
            taskText: dbTask.task_text,
            scheduledDate: dbTask.scheduled_date,
            scheduledTime: dbTask.scheduled_time,
            timezone: dbTask.timezone,
            recurrenceRule: dbTask.recurrence_rule,
            status: dbTask.status,
            createdTimestamp: new Date(dbTask.created_at).getTime(),
            completedTimestamp: dbTask.completed_at ? new Date(dbTask.completed_at).getTime() : null,
            snoozedUntil: dbTask.snoozed_until ? new Date(dbTask.snoozed_until).getTime() : null,
          } as Task));
          setTasks(parsed);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Supabase fetch failed, falling back to local storage");
    }
    
    // Fallback to local storage for test mode if Supabase fails
    const data = localStorage.getItem('daily_task_tasks');
    const localTasks: Task[] = data ? JSON.parse(data) : [];
    setTasks(localTasks.filter(t => t.userId === user.id));
    setLoading(false);
  };

  useEffect(() => {
    refreshTasks();
  }, [user.id]);

  const saveTask = async (task: Task) => {
    setTasks(prev => [...prev, task]); // Optimistic
    try {
      if (!hasSupabaseKeys) throw new Error("No keys");
      const { error } = await supabase.from('tasks').insert([{
        id: task.id,
        user_id: task.userId,
        task_text: task.taskText,
        scheduled_date: task.scheduledDate,
        scheduled_time: task.scheduledTime,
        status: task.status,
        timezone: task.timezone,
        recurrence_rule: task.recurrenceRule,
        created_at: new Date(task.createdTimestamp).toISOString(),
        completed_at: task.completedTimestamp ? new Date(task.completedTimestamp).toISOString() : null,
        snoozed_until: task.snoozedUntil ? new Date(task.snoozedUntil).toISOString() : null
      }]);
      if (error) throw error;
      return;
    } catch (err) {
      // Fallback
    }
    
    const data = localStorage.getItem('daily_task_tasks');
    const localTasks: Task[] = data ? JSON.parse(data) : [];
    localTasks.push(task);
    localStorage.setItem('daily_task_tasks', JSON.stringify(localTasks));
  };

  const updateTask = async (task: Task) => {
    setTasks(prev => prev.map(t => t.id === task.id ? task : t)); // Optimistic
    try {
      if (!hasSupabaseKeys) throw new Error("No keys");
      const { error } = await supabase.from('tasks').update({
        task_text: task.taskText,
        scheduled_date: task.scheduledDate,
        scheduled_time: task.scheduledTime,
        timezone: task.timezone,
        recurrence_rule: task.recurrenceRule,
        status: task.status,
        completed_at: task.completedTimestamp ? new Date(task.completedTimestamp).toISOString() : null,
        snoozed_until: task.snoozedUntil ? new Date(task.snoozedUntil).toISOString() : null
      }).eq('id', task.id);
      if (error) throw error;
      return;
    } catch (err) {
      // Fallback
    }
    
    const data = localStorage.getItem('daily_task_tasks');
    let localTasks: Task[] = data ? JSON.parse(data) : [];
    localTasks = localTasks.map(t => t.id === task.id ? task : t);
    localStorage.setItem('daily_task_tasks', JSON.stringify(localTasks));
  };

  return (
    <TaskContext.Provider value={{ tasks, loading, refreshTasks, saveTask, updateTask }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
}
