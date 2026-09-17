const fs = require('fs');
let code = fs.readFileSync('src/components/ReminderModal.tsx', 'utf8');

code = code.replace(
`    // Start continuous alarm sound
    const soundType = user?.alarmSoundType || 'strong';
    const volume = user?.alarmVolume ?? 75;
    
    playAlarmSound(soundType, volume).catch(err => {`,
`    // Start continuous alarm sound
    const soundType = user?.alarmSoundType || 'native';
    const volume = user?.alarmVolume ?? 75;
    const vibrate = user?.alarmVibrationEnabled ?? true;
    
    playAlarmSound(soundType as any, volume, vibrate).catch(err => {`
);

fs.writeFileSync('src/components/ReminderModal.tsx', code);
