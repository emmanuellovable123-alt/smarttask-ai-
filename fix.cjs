const fs = require('fs');
let code = fs.readFileSync('src/lib/ReminderService.ts', 'utf8');
code = code.replace(
  /\(window as any\)\.AndroidAlarmManager\.scheduleAlarm\(id, timeMs, title, message\);\n      \/\/ Ensure we catch if it's a promise\n      const maybePromise/g,
  "const maybePromise"
);
code = code.replace(
  /\(window as any\)\.AndroidAlarmManager\.cancelAlarm\(id\);\n      \/\/ Ensure we catch if it's a promise\n      const maybePromise/g,
  "const maybePromise"
);
code = code.replace(
  /\(window as any\)\.AndroidAlarmManager\.syncSettings\(soundType, volume, customFileName \|\| '', vibrate\);\n      \/\/ Ensure we catch if it's a promise\n      const maybePromise/g,
  "const maybePromise"
);
code = code.replace(
  /\(window as any\)\.AndroidAlarmManager\.syncSettings\(soundType, volume, customFileName \|\| ''\);\n      \/\/ Ensure we catch if it's a promise\n      const maybePromise/g,
  "const maybePromise"
);
code = code.replace(
  /\(window as any\)\.AndroidAlarmManager\.stopAlarm\(\);\n      \/\/ Ensure we catch if it's a promise\n      const maybePromise/g,
  "const maybePromise"
);
fs.writeFileSync('src/lib/ReminderService.ts', code);
