// Scheduled slots for the November 2026 SNS switch (growth plan W6). Times are Asia/Seoul.
// The legacy news runner keeps its own 10:00/10:15 dailySlots in news.mjs.
const DAY=86400000;
const WEEKDAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export const koreanDay = date => new Date(date.getTime()+9*3600000).toISOString().slice(0,10);
const weekday = day => WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()];

export function validateSchedule(schedule) {
  const time=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if(!time.test(schedule?.threads?.time||''))throw new Error('promotion/config.json schedule.threads.time must be HH:MM (Asia/Seoul).');
  const instagram=schedule.instagram;
  if(instagram?.format!=='carousel'||!time.test(instagram.time||'')||!Array.isArray(instagram.days)||!instagram.days.length||instagram.days.length>3||instagram.days.some(d=>!WEEKDAYS.includes(d))||new Set(instagram.days).size!==instagram.days.length)throw new Error('schedule.instagram needs format "carousel", HH:MM and 1–3 weekdays.');
  return schedule;
}
function slotAt(day,time,platform,suffix) {
  const scheduledAt=new Date(`${day}T${time}:00+09:00`).toISOString();
  return {platform,scheduledAt,id:`${platform==='threads'?'T':'I'}-${day}-${time.replace(':','')}-${suffix}`};
}
// The next Threads slot that has not started yet: today if before the posting time, else tomorrow.
export function threadsSlot(now,schedule,suffix='page') {
  validateSchedule(schedule);
  let day=koreanDay(now);
  if(now.getTime()>=Date.parse(`${day}T${schedule.threads.time}:00+09:00`))day=koreanDay(new Date(now.getTime()+DAY));
  return slotAt(day,schedule.threads.time,'threads',suffix);
}
// Instagram posts only on carousel days. Preparation runs the same morning, so only today's slot counts.
export function carouselSlot(now,schedule) {
  validateSchedule(schedule);
  const day=koreanDay(now),slot=slotAt(day,schedule.instagram.time,'instagram','carousel');
  if(!schedule.instagram.days.includes(weekday(day))||Date.parse(slot.scheduledAt)<=now.getTime())return null;
  return slot;
}
// systemd OnCalendar values that must match the configured slots; tests compare them to the unit files.
export function timerCalendars(schedule) {
  validateSchedule(schedule);
  return {
    threads:`*-*-* ${schedule.threads.time}:00 Asia/Seoul`,
    instagram:`${schedule.instagram.days.join(',')} *-*-* ${schedule.instagram.time}:00 Asia/Seoul`,
  };
}
