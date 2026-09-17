const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');

const regex = /  const handleVibrationChange = async \([\s\S]*?setIsSaving\(false\), 500\);\n  \};/m;
code = code.replace(regex, 
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
  };

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      const updatedUser = {
        ...user,
        alarmSoundType: soundType as any,
        alarmVolume: volume,
        alarmVibrationEnabled: vibrationEnabled
      };
      
      await onUpdateUser(updatedUser);
      
      if (hasSupabaseKeys) {
        try {
          await supabase.from('profiles').update({ 
             alarm_sound_type: soundType,
             alarm_volume: volume,
             alarm_vibration_enabled: vibrationEnabled
          }).eq('id', user.id);
        } catch (err) {
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  };`);
fs.writeFileSync('src/components/SettingsView.tsx', code);
