import { DateTime, Interval } from 'luxon';
import { config } from './config.js';

export function buildWorkingWindows(now) {
  const windows = [];
  const startOfToday = now.startOf('day');
  for (let d = 0; d < config.daysAhead; d++) {
    const day = startOfToday.plus({ days: d });
    if (!config.workDays.includes(day.weekday)) continue;

    const dayStart = day.set({ hour: config.workStartHour, minute: 0, second: 0, millisecond: 0 });
    const dayEnd = day.set({ hour: config.workEndHour, minute: 0, second: 0, millisecond: 0 });

    const start = d === 0 && now > dayStart ? now : dayStart;
    if (start >= dayEnd) continue;

    windows.push(Interval.fromDateTimes(start, dayEnd));
  }
  return windows;
}

export function busyToIntervals(busy, zone) {
  return busy
    .map((b) => Interval.fromDateTimes(DateTime.fromISO(b.start, { zone }), DateTime.fromISO(b.end, { zone })))
    .filter((iv) => iv.isValid && iv.length('minutes') > 0)
    .sort((a, b) => a.start - b.start);
}

function mergeIntervals(intervals) {
  if (intervals.length === 0) return [];
  const merged = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1];
    const cur = intervals[i];
    if (cur.start <= last.end) {
      merged[merged.length - 1] = Interval.fromDateTimes(last.start, cur.end > last.end ? cur.end : last.end);
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

export function subtractBusyFromWindow(window, busyIntervals) {
  const overlapping = mergeIntervals(
    busyIntervals.filter((b) => b.overlaps(window)).map((b) => b.intersection(window)).filter(Boolean),
  );
  if (overlapping.length === 0) return [window];

  const free = [];
  let cursor = window.start;
  for (const b of overlapping) {
    if (b.start > cursor) free.push(Interval.fromDateTimes(cursor, b.start));
    if (b.end > cursor) cursor = b.end;
  }
  if (cursor < window.end) free.push(Interval.fromDateTimes(cursor, window.end));
  return free;
}

export function computeFreeSlots({ busy, now }) {
  const zone = config.timezone;
  const ref = (now ?? DateTime.now()).setZone(zone);
  const windows = buildWorkingWindows(ref);
  const busyIntervals = busyToIntervals(busy, zone);
  const minMs = config.minSlotMinutes * 60 * 1000;

  const slotsByDate = new Map();
  for (const window of windows) {
    const dateKey = window.start.toISODate();
    const free = subtractBusyFromWindow(window, busyIntervals)
      .filter((iv) => iv.length('milliseconds') >= minMs)
      .map((iv) => ({
        start: iv.start.toISO(),
        end: iv.end.toISO(),
        startLabel: iv.start.toFormat('HH:mm'),
        endLabel: iv.end.toFormat('HH:mm'),
        durationMinutes: Math.round(iv.length('minutes')),
      }));

    slotsByDate.set(dateKey, {
      date: dateKey,
      weekday: window.start.toFormat('cccc'),
      dateLabel: window.start.toFormat('d LLL'),
      slots: free,
    });
  }

  return {
    timezone: zone,
    workStartHour: config.workStartHour,
    workEndHour: config.workEndHour,
    workDays: config.workDays,
    generatedAt: ref.toISO(),
    days: Array.from(slotsByDate.values()),
  };
}
