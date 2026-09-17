import localforage from 'localforage';

// Configure localforage for audio
localforage.config({
  name: 'DailyTaskAI',
  storeName: 'audio_store'
});

const AUDIO_KEY = 'custom_alarm_audio';
const AUDIO_NAME_KEY = 'custom_alarm_audio_name';

export async function saveCustomAudio(file: File): Promise<string> {
  // Store the actual file blob
  await localforage.setItem(AUDIO_KEY, file);
  await localforage.setItem(AUDIO_NAME_KEY, file.name);
  return file.name;
}

export async function getCustomAudioBlob(): Promise<Blob | null> {
  return await localforage.getItem<Blob>(AUDIO_KEY);
}

export async function getCustomAudioName(): Promise<string | null> {
  return await localforage.getItem<string>(AUDIO_NAME_KEY);
}

let activeAudio: HTMLAudioElement | null = null;
let activeOscillator: OscillatorNode | null = null;
let activeAudioContext: AudioContext | null = null;

// Synthetic sounds for fallback/default
function playSyntheticSound(type: 'classic' | 'strong' | 'urgent', volume: number) {
  stopAudio(); // Stop any existing
  
  try {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    activeAudioContext = new AudioContextClass();
    const ctx = activeAudioContext!;
    
    // Convert percentage volume (0-100) to actual gain (0-1)
    const normalizedVolume = Math.max(0, Math.min(100, volume)) / 100;
    
    if (type === 'classic') {
      // Gentle beep beep
      playBeepSequence(ctx, normalizedVolume, [
        { f: 800, start: 0, dur: 0.2 },
        { f: 800, start: 0.4, dur: 0.2 },
        { f: 800, start: 1.0, dur: 0.2 },
        { f: 800, start: 1.4, dur: 0.2 }
      ], 2.0);
    } else if (type === 'strong') {
      // Lower, louder, sustained tone
      playBeepSequence(ctx, normalizedVolume, [
        { f: 400, start: 0, dur: 0.8 },
        { f: 400, start: 1.0, dur: 0.8 }
      ], 2.0);
    } else if (type === 'urgent') {
      // High pitch, fast repeating
      playBeepSequence(ctx, normalizedVolume, [
        { f: 1200, start: 0, dur: 0.1 },
        { f: 1200, start: 0.2, dur: 0.1 },
        { f: 1200, start: 0.4, dur: 0.1 },
        { f: 1200, start: 0.6, dur: 0.1 }
      ], 1.0);
    }
  } catch (err) {
    console.error("Audio generation failed:", err);
  }
}

function playBeepSequence(ctx: AudioContext, vol: number, beeps: {f: number, start: number, dur: number}[], loopTime: number) {
  const scheduleBeeps = (startTime: number) => {
    beeps.forEach(b => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = b.f;
      
      gain.gain.setValueAtTime(0, startTime + b.start);
      gain.gain.linearRampToValueAtTime(vol, startTime + b.start + 0.05);
      gain.gain.setValueAtTime(vol, startTime + b.start + b.dur - 0.05);
      gain.gain.linearRampToValueAtTime(0, startTime + b.start + b.dur);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime + b.start);
      osc.stop(startTime + b.start + b.dur);
      
      // Store the last one just in case we need to forcefully stop
      activeOscillator = osc;
    });
    
    // We can't strictly loop dynamic nodes easily in a simple way without a worklet, 
    // so we'll just schedule one cycle and let the alarm logic re-trigger or we can use setInterval.
    // Actually, for continuous ringing, a simple setInterval works since the browser is active.
    (ctx as any).loopInterval = setInterval(() => {
      if (activeAudioContext !== ctx) {
        clearInterval((ctx as any).loopInterval);
        return;
      }
      const now = ctx.currentTime;
      beeps.forEach(b => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = b.f;
        gain.gain.setValueAtTime(0, now + b.start);
        gain.gain.linearRampToValueAtTime(vol, now + b.start + 0.05);
        gain.gain.setValueAtTime(vol, now + b.start + b.dur - 0.05);
        gain.gain.linearRampToValueAtTime(0, now + b.start + b.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + b.start);
        osc.stop(now + b.start + b.dur);
        activeOscillator = osc;
      });
    }, loopTime * 1000);
  };
  
  scheduleBeeps(ctx.currentTime);
}

let vibrationInterval: number | null = null;

function startVibration() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([1000, 1000]);
    vibrationInterval = window.setInterval(() => {
      navigator.vibrate([1000, 1000]);
    }, 2000);
  }
}

function stopVibration() {
  if (vibrationInterval !== null) {
    clearInterval(vibrationInterval);
    vibrationInterval = null;
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(0);
  }
}

export async function playAlarmSound(type: 'native' | 'classic' | 'strong' | 'urgent' | 'custom', volume: number, enableVibration: boolean = true) {
  stopAudio();
  
  if (enableVibration) {
    startVibration();
  }

  if (type === 'native') {
    playSyntheticSound('strong', volume);
  } else if (type === 'custom') {
    try {
      const blob = await getCustomAudioBlob();
      if (blob) {
        const url = URL.createObjectURL(blob);
        activeAudio = new Audio(url);
        activeAudio.volume = Math.max(0, Math.min(100, volume)) / 100;
        activeAudio.loop = true;
        await activeAudio.play();
        return; // Success
      }
    } catch (err) {
      console.warn("Failed to play custom audio, falling back to strong wake", err);
    }
    // Fallback if blob is missing or fails to play
    playSyntheticSound('strong', volume);
  } else {
    playSyntheticSound(type, volume);
  }
}

export function stopAudio() {
  stopVibration();
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  if (activeAudioContext) {
    if ((activeAudioContext as any).loopInterval) {
      clearInterval((activeAudioContext as any).loopInterval);
    }
    activeAudioContext.close().catch(() => {});
    activeAudioContext = null;
  }
  if (activeOscillator) {
    activeOscillator = null;
  }
}
