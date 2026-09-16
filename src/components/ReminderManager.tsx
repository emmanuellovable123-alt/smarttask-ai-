import { useState, useEffect } from 'react';
import { Task } from '../types';
import { useTasks } from '../lib/TaskContext';
import { useAdManager } from '../lib/AdContext';
import { getNow, parseTaskDateTime } from '../lib/dateUtils';
import { ReminderModal } from './ReminderModal';
import { ReminderService, ScheduledReminder } from '../lib/ReminderService';

export function ReminderManager({ userId, onTasksUpdated }: { userId: string, onTasksUpdated: () => void }) {
  const { tasks, updateTask } = useTasks();
  const { showAd } = useAdManager();
  const [activeReminders, setActiveReminders] = useState<ScheduledReminder[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        setPermission(Notification.permission);
        if (Notification.permission === 'default') {
          const requestPromise = Notification.requestPermission((permission) => {
            setPermission(permission);
          });
          if (requestPromise && typeof requestPromise.then === 'function') {
            requestPromise
              .then(setPermission)
              .catch((err) => console.warn('Notification permission error:', err));
          }
        }
      } catch (err) {
        console.warn('Notification API error:', err);
      }
    }
  }, []);

  // Set up ReminderService callback
  useEffect(() => {
    ReminderService.setCallback((reminder) => {
      setActiveReminders(prev => {
        if (prev.find(r => r.taskId === reminder.taskId)) return prev;
        return [...prev, reminder];
      });
      if (permission === 'granted') {
        new Notification('Daily TASK AI', {
          body: `Don't forget! You wanted to ${reminder.taskText}.`,
        });
      }
    });
    
    return () => ReminderService.setCallback(null as any);
  }, [permission]);

  // Sync tasks to ReminderService and handle Overdue/Not Fulfilled
  useEffect(() => {
    const syncTasks = async () => {
      try {
        let tasksUpdated = false;
        const now = getNow();
        const nowDate = new Date(now);
        const isPast9PM = nowDate.getHours() >= 21;
        
        const previouslyTriggeredStr = localStorage.getItem(`triggered_reminders_${userId}`) || '[]';
        const previouslyTriggered: string[] = JSON.parse(previouslyTriggeredStr);

        for (const task of tasks) {
          if (task.status === 'Cancelled' || task.status === 'Fulfilled' || task.status === 'Not Fulfilled') {
            ReminderService.cancelReminder(task.id);
            continue;
          }

          // Auto mark Not Fulfilled if past 9 PM
          if (isPast9PM && task.status === 'Pending') {
            const taskTimestamp = parseTaskDateTime(task.scheduledDate, task.scheduledTime);
            if (taskTimestamp && taskTimestamp < now) {
              const updated = { ...task, status: 'Not Fulfilled' as const };
              await updateTask(updated);
              tasksUpdated = true;
              continue;
            }
          }

          const taskTime = task.snoozedUntil || parseTaskDateTime(task.scheduledDate, task.scheduledTime);
          if (taskTime) {
            if (taskTime > now) {
              // Schedule future reminder
              ReminderService.scheduleReminder(task, taskTime);
            } else {
              // It's in the past. If not triggered before, trigger it now.
              if (!previouslyTriggered.includes(task.id) && !activeReminders.find(r => r.taskId === task.id)) {
                previouslyTriggered.push(task.id);
                localStorage.setItem(`triggered_reminders_${userId}`, JSON.stringify(previouslyTriggered));
                
                const updated = { ...task, alarmStatus: 'ringing' as const, alarmStartedAt: getNow() };
                updateTask(updated).catch(e => console.error("Error setting alarm to ringing", e));
                
                const reminder: ScheduledReminder = {
                  taskId: task.id,
                  userId: task.userId,
                  taskText: task.taskText,
                  scheduledDate: task.scheduledDate,
                  scheduledTime: task.scheduledTime,
                  timezone: task.timezone,
                  status: 'Triggered',
                  triggerTimeMs: taskTime
                };
                setActiveReminders(prev => [...prev, reminder]);
                
                if (permission === 'granted') {
                  new Notification('Daily TASK AI', {
                    body: `Don't forget! You wanted to ${task.taskText}.`,
                  });
                }
              }
            }
          }
        }

        if (tasksUpdated) {
          await onTasksUpdated();
        }
      } catch (err) {
        console.error('Error in syncTasks:', err);
      }
    };
    
    syncTasks();
  }, [tasks, userId, permission, updateTask, onTasksUpdated, activeReminders]);

  const handleAcknowledge = async (taskId: string) => {
    setActiveReminders(prev => prev.filter(t => t.taskId !== taskId));
  };

  const handleFulfill = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        const updated = { ...task, status: 'Fulfilled' as const, completedTimestamp: getNow(), alarmStatus: 'fulfilled' as const };
        await updateTask(updated);
        await onTasksUpdated();
      }
      await handleAcknowledge(taskId);
    } catch (err) {
      console.error('Error fulfilling task:', err);
    }
  };

  const handleSnooze = async (taskId: string, ms: number) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        const updated = { ...task, snoozedUntil: getNow() + ms, alarmStatus: 'snoozed' as const };
        await updateTask(updated);
        
        const previouslyTriggeredStr = localStorage.getItem(`triggered_reminders_${userId}`) || '[]';
        let previouslyTriggered: string[] = JSON.parse(previouslyTriggeredStr);
        previouslyTriggered = previouslyTriggered.filter(id => id !== taskId);
        localStorage.setItem(`triggered_reminders_${userId}`, JSON.stringify(previouslyTriggered));
        
        // The useEffect will pick this up and reschedule
        await onTasksUpdated();
      }
      await handleAcknowledge(taskId);
    } catch (err) {
      console.error('Error snoozing task:', err);
    }
  };

  const handleExpire = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        const updated = { ...task, alarmStatus: 'expired' as const, alarmExpiredAt: getNow() };
        await updateTask(updated);
        await onTasksUpdated();
      }
      await handleAcknowledge(taskId);
    } catch (err) {
      console.error('Error expiring task:', err);
    }
  };

  if (activeReminders.length === 0) return null;

  // We need to pass a full Task object to ReminderModal, so let's find it
  const activeTask = tasks.find(t => t.id === activeReminders[0].taskId);
  if (!activeTask) return null;

  return (
    <ReminderModal
      task={activeTask}
      userId={userId}
      notificationPermission={permission}
      onAcknowledge={async () => {
        const task = tasks.find(t => t.id === activeTask.id);
        if (task) {
          await updateTask({ ...task, alarmStatus: 'acknowledged' as const, alarmAcknowledgedAt: getNow() }).catch(e => console.error(e));
        }
        await handleAcknowledge(activeTask.id).catch(e => console.error(e));
      }}
      onFulfill={() => handleFulfill(activeTask.id)}
      onSnooze={(ms) => handleSnooze(activeTask.id, ms)}
      onExpire={() => handleExpire(activeTask.id)}
    />
  );
}
