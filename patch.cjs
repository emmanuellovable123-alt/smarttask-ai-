const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');

code = code.replace(
`  const handleSaveSettings = async () => {
    setIsSaving(true);
    const updatedUser = {
      ...user,
      alarmSoundType: soundType as any,
      alarmVolume: volume
    };
    
    // Save to App state and localStorage
    onUpdateUser(updatedUser);
    
    // Attempt Supabase save
    if (hasSupabaseKeys) {
      try {
        // Only sending standard fields to avoid breaking if alarm columns missing in DB
        // since we don't have schema guarantees for the new columns in Supabase
        await supabase.from('profiles').update({ 
           alarm_sound_type: soundType,
           alarm_volume: volume
        }).eq('id', user.id);
      } catch (err) {
        // Ignore DB update errors since it's saved locally
      }
    }`,
`  const handleVibrationChange = async (enabled: boolean) => {
    setVibrationEnabled(enabled);
    const updatedUser = {
      ...user,
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
        // Only sending standard fields to avoid breaking if alarm columns missing in DB
        // since we don't have schema guarantees for the new columns in Supabase
        await supabase.from('profiles').update({ 
           alarm_sound_type: soundType,
           alarm_volume: volume,
           alarm_vibration_enabled: vibrationEnabled
        }).eq('id', user.id);
      } catch (err) {
        // Ignore DB update errors since it's saved locally
      }
    }`
);
fs.writeFileSync('src/components/SettingsView.tsx', code);
