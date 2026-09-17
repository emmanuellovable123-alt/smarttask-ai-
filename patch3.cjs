const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');

code = code.replace(
`                </div>
              </div>
              
              <div className="flex items-center gap-3 mt-6">
                <button `,
`                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Vibrate During Alarm</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleVibrationChange(!vibrationEnabled)}
                  className={\`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none \${vibrationEnabled ? 'bg-indigo-600' : 'bg-slate-200'}\`}
                >
                  <span className={\`inline-block h-4 w-4 transform rounded-full bg-white transition-transform \${vibrationEnabled ? 'translate-x-6' : 'translate-x-1'}\`} />
                </button>
              </div>
              
              <div className="flex items-center gap-3 mt-6">
                <button `
);

fs.writeFileSync('src/components/SettingsView.tsx', code);
