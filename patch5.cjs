const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');

// First replace the body of handleSaveSettings
code = code.replace(
/  const handleSaveSettings = async \(\) => \{[\s\S]*?setIsSaving\(false\), 500\);\n  \};/,
`  const handleVibrationChange = async (enabled: boolean) => {
    setVibrationEnabled(enabled);
    const updatedUser = {
      ...user,
      alarmSoundType: soundType as any,
      alarmVolume: volume,
      alarmVibrationEnabled: enabled
    };
    onUpdateUser(updatedUser);
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    const updatedUser = {
      ...user,
      alarmSoundType: soundType as any,
      alarmVolume: volume,
      alarmVibrationEnabled: vibrationEnabled
    };
    
    // Save to App state and localStorage
    onUpdateUser(updatedUser);
    
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
    
    setTimeout(() => setIsSaving(false), 500);
  };`
);

fs.writeFileSync('src/components/SettingsView.tsx', code);
