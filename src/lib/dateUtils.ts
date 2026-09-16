export function parseTaskDateTime(dateStr: string, timeStr: string): number | null {
  if (!timeStr) return null; // Time is required for a reminder
  
  const now = new Date(getNow());
  let targetDate = new Date(now);

  const d = dateStr.toLowerCase();
  
  if (d === 'tomorrow') {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (d === 'next week') {
    targetDate.setDate(targetDate.getDate() + 7);
  } else if (d.match(/^[a-z]+day$/)) { // e.g. "monday", "tuesday"
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = days.indexOf(d);
    if (targetDay !== -1) {
      let currentDay = targetDate.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7; // Next occurrence
      targetDate.setDate(targetDate.getDate() + diff);
    }
  }

  // Parse time (e.g. "18:00" or "6:00 PM" or "6 PM")
  let hours = 0;
  let minutes = 0;
  
  // Try 24h format first "HH:MM" or "HH:MM:SS"
  const timeMatch24 = timeStr.match(/^(\d{1,2}):(\d{2})/);
  const timeMatch12 = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);

  if (timeMatch12) {
    hours = parseInt(timeMatch12[1], 10);
    minutes = timeMatch12[2] ? parseInt(timeMatch12[2], 10) : 0;
    const ampm = timeMatch12[3].toLowerCase();
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
  } else if (timeMatch24) {
    hours = parseInt(timeMatch24[1], 10);
    minutes = parseInt(timeMatch24[2], 10);
  } else {
    // If we can't parse time, return null
    return null;
  }

  targetDate.setHours(hours, minutes, 0, 0);
  return targetDate.getTime();
}

export function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

// Development flag to simulate times
let simulationOffset = 0;

export function getNow() {
  return Date.now() + simulationOffset;
}

export function simulateTime(addMs: number) {
  simulationOffset += addMs;
}

export function setSimulateTo9PM() {
  const now = new Date(getNow());
  now.setHours(21, 0, 0, 0);
  simulationOffset = now.getTime() - Date.now();
}

export function getSimulationOffset() {
    return simulationOffset;
}

export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    return 'UTC';
  }
}
