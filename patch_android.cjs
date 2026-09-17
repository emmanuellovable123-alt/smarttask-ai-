const fs = require('fs');
let code = fs.readFileSync('src/lib/ReminderService.ts', 'utf8');
code = code.replace(
  /\(window as any\)\.AndroidAlarmManager\.([a-zA-Z]+)\((.*?)\);/g,
  `(window as any).AndroidAlarmManager.$1($2);\n      // Ensure we catch if it's a promise\n      const maybePromise = (window as any).AndroidAlarmManager.$1($2);\n      if (maybePromise && typeof maybePromise.catch === 'function') maybePromise.catch((e: any) => console.error(e));`
);
fs.writeFileSync('src/lib/ReminderService.ts', code);
