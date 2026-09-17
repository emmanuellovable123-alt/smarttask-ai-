const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');
code = code.replace(
  /window\.addEventListener\('unhandledrejection', \(event\) => \{\n  console\.error\('Unhandled promise rejection:', event\.reason\);\n\}\);/,
  `window.addEventListener('unhandledrejection', (event) => {
  console.warn('Suppressed global promise rejection:', event.reason || event);
  event.preventDefault();
});`
);
fs.writeFileSync('src/main.tsx', code);
