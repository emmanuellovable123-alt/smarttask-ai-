const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceTaskModal.tsx', 'utf8');
code = code.replace(
  /const stream = await navigator\.mediaDevices\.getUserMedia\(\{ audio: true \}\);/g,
  `if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn("navigator.mediaDevices.getUserMedia not supported in this browser.");
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("Microphone permission granted");
        stream.getTracks().forEach(track => track.stop());
      }`
);
code = code.replace(
  /console\.log\("Microphone permission granted"\);\n      stream\.getTracks\(\)\.forEach\(track => track\.stop\(\)\);/g,
  ""
);
fs.writeFileSync('src/components/VoiceTaskModal.tsx', code);
