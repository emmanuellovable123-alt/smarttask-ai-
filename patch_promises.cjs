const fs = require('fs');

// Patch SettingsView.tsx
let settings = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');
settings = settings.replace(
/  const handleVibrationChange = async \(enabled: boolean\) => \{[\s\S]*?  \};/,
`  const handleVibrationChange = async (enabled: boolean) => {
    try {
      setVibrationEnabled(enabled);
      const updatedUser = {
        ...user,
        alarmSoundType: soundType as any,
        alarmVolume: volume,
        alarmVibrationEnabled: enabled
      };
      await onUpdateUser(updatedUser);
    } catch (err) {
      console.error(err);
    }
  };`
);
settings = settings.replace(
/  const handleSaveSettings = async \(\) => \{[\s\S]*?setIsSaving\(false\), 500\);\n  \};/,
`  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      const updatedUser = {
        ...user,
        alarmSoundType: soundType as any,
        alarmVolume: volume,
        alarmVibrationEnabled: vibrationEnabled
      };
      
      // Save to App state and localStorage
      await onUpdateUser(updatedUser);
      
      // Attempt Supabase save
      if (hasSupabaseKeys) {
        try {
          await supabase.from('profiles').update({ 
             alarm_sound_type: soundType,
             alarm_volume: volume,
             alarm_vibration_enabled: vibrationEnabled
          }).eq('id', user.id);
        } catch (err) {
          // Ignore DB update errors since it's saved locally
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  };`
);
fs.writeFileSync('src/components/SettingsView.tsx', settings);

// Patch TaskContext.tsx
let tc = fs.readFileSync('src/lib/TaskContext.tsx', 'utf8');
tc = tc.replace(
`  useEffect(() => {
    refreshTasks();
  }, [user.id]);`,
`  useEffect(() => {
    refreshTasks().catch(err => console.error("Unhandled rejection in refreshTasks:", err));
  }, [user.id]);`
);
// Also wrap the JSON.parse parts in try/catch to avoid rejecting the promise unexpectedly
tc = tc.replace(
`    // Fallback to local storage for test mode if Supabase fails
    const data = localStorage.getItem('daily_task_tasks');
    const localTasks: Task[] = data ? JSON.parse(data) : [];
    setTasks(localTasks.filter(t => t.userId === user.id));
    setLoading(false);`,
`    // Fallback to local storage for test mode if Supabase fails
    try {
      const data = localStorage.getItem('daily_task_tasks');
      const localTasks: Task[] = data ? JSON.parse(data) : [];
      setTasks(localTasks.filter(t => t.userId === user.id));
    } catch (e) {
      console.error("Local storage error:", e);
      setTasks([]);
    } finally {
      setLoading(false);
    }`
);
fs.writeFileSync('src/lib/TaskContext.tsx', tc);

// Patch App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace(
`  const handleUpdateUser = async (updatedUser: User) => {
    setUser(updatedUser);
    store.setCurrentUser(updatedUser);
    store.updateUser(updatedUser);
  };`,
`  const handleUpdateUser = async (updatedUser: User) => {
    try {
      setUser(updatedUser);
      store.setCurrentUser(updatedUser);
      store.updateUser(updatedUser);
    } catch (e) {
      console.error(e);
    }
  };`
);
fs.writeFileSync('src/App.tsx', appCode);

