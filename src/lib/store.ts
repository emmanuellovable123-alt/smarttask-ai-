import { Task, User } from '../types';

const STORAGE_KEYS = {
  USERS: 'daily_task_users',
  TASKS: 'daily_task_tasks',
  CURRENT_USER: 'daily_task_current_user',
};

export const store = {
  getUsers: (): User[] => {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : [];
  },
  
  saveUser: (user: User) => {
    const users = store.getUsers();
    users.push(user);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },
  
  updateUser: (updatedUser: User) => {
    const users = store.getUsers();
    const index = users.findIndex(u => u.id === updatedUser.id);
    if (index !== -1) {
      users[index] = updatedUser;
    } else {
      users.push(updatedUser);
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },
  
  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return data ? JSON.parse(data) : null;
  },
  
  setCurrentUser: (user: User | null) => {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  },

  getTasks: (userId: string): Task[] => {
    const data = localStorage.getItem(STORAGE_KEYS.TASKS);
    const tasks: Task[] = data ? JSON.parse(data) : [];
    return tasks.filter(t => t.userId === userId);
  },

  saveTask: (task: Task) => {
    const data = localStorage.getItem(STORAGE_KEYS.TASKS);
    const tasks: Task[] = data ? JSON.parse(data) : [];
    tasks.push(task);
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  },

  updateTask: (updatedTask: Task) => {
    const data = localStorage.getItem(STORAGE_KEYS.TASKS);
    let tasks: Task[] = data ? JSON.parse(data) : [];
    tasks = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  }
};
