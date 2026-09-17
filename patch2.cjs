const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');

code = code.replace(
`{['classic', 'strong', 'urgent', 'custom'].map((type) => (`,
`{['native', 'classic', 'strong', 'urgent', 'custom'].map((type) => (`
);

code = code.replace(
`                      {type === 'classic' && 'Classic Wake'}
                      {type === 'strong' && 'Strong Wake'}
                      {type === 'urgent' && 'Urgent Wake'}
                      {type === 'custom' && 'Custom Sound'}`,
`                      {type === 'native' && 'Native Alarm Clock Ringtone'}
                      {type === 'classic' && 'Classic Wake'}
                      {type === 'strong' && 'Strong Wake'}
                      {type === 'urgent' && 'Urgent Wake'}
                      {type === 'custom' && 'Custom Sound'}`
);

fs.writeFileSync('src/components/SettingsView.tsx', code);
