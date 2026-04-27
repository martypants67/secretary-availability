import { strict as assert } from 'node:assert';
import { DateTime } from 'luxon';
import { test } from 'node:test';

process.env.SECRETARY_EMAIL ||= 'test@example.com';
process.env.GOOGLE_APPLICATION_CREDENTIALS ||= './config/service-account.json';
process.env.TIMEZONE = 'Europe/London';
process.env.WORK_START_HOUR = '9';
process.env.WORK_END_HOUR = '17';
process.env.WORK_DAYS = '1,2,3,4,5';
process.env.DAYS_AHEAD = '7';
process.env.MIN_SLOT_MINUTES = '15';

const { computeFreeSlots, buildWorkingWindows } = await import('./availability.js');

test('weekend days are excluded', () => {
  const sat = DateTime.fromISO('2026-05-02T08:00', { zone: 'Europe/London' });
  const result = computeFreeSlots({ busy: [], now: sat });
  for (const day of result.days) {
    const wd = DateTime.fromISO(day.date, { zone: 'Europe/London' }).weekday;
    assert.ok(wd >= 1 && wd <= 5, `${day.date} (weekday ${wd}) should be a weekday`);
  }
});

test('a fully free weekday returns the whole 09:00-17:00 window', () => {
  const mon = DateTime.fromISO('2026-04-27T06:00', { zone: 'Europe/London' });
  const result = computeFreeSlots({ busy: [], now: mon });
  const today = result.days.find((d) => d.date === '2026-04-27');
  assert.ok(today, 'expected today in result');
  assert.equal(today.slots.length, 1);
  assert.equal(today.slots[0].startLabel, '09:00');
  assert.equal(today.slots[0].endLabel, '17:00');
  assert.equal(today.slots[0].durationMinutes, 480);
});

test('busy block in the middle splits the day into two free slots', () => {
  const mon = DateTime.fromISO('2026-04-27T06:00', { zone: 'Europe/London' });
  const busy = [{ start: '2026-04-27T11:00:00+01:00', end: '2026-04-27T12:30:00+01:00' }];
  const result = computeFreeSlots({ busy, now: mon });
  const today = result.days.find((d) => d.date === '2026-04-27');
  assert.equal(today.slots.length, 2);
  assert.deepEqual(
    today.slots.map((s) => `${s.startLabel}-${s.endLabel}`),
    ['09:00-11:00', '12:30-17:00'],
  );
});

test('busy block outside the working window is ignored', () => {
  const mon = DateTime.fromISO('2026-04-27T06:00', { zone: 'Europe/London' });
  const busy = [{ start: '2026-04-27T18:00:00+01:00', end: '2026-04-27T19:00:00+01:00' }];
  const result = computeFreeSlots({ busy, now: mon });
  const today = result.days.find((d) => d.date === '2026-04-27');
  assert.equal(today.slots.length, 1);
  assert.equal(today.slots[0].startLabel, '09:00');
  assert.equal(today.slots[0].endLabel, '17:00');
});

test('overlapping busy blocks are merged before subtraction', () => {
  const mon = DateTime.fromISO('2026-04-27T06:00', { zone: 'Europe/London' });
  const busy = [
    { start: '2026-04-27T10:00:00+01:00', end: '2026-04-27T11:00:00+01:00' },
    { start: '2026-04-27T10:30:00+01:00', end: '2026-04-27T12:00:00+01:00' },
  ];
  const result = computeFreeSlots({ busy, now: mon });
  const today = result.days.find((d) => d.date === '2026-04-27');
  assert.deepEqual(
    today.slots.map((s) => `${s.startLabel}-${s.endLabel}`),
    ['09:00-10:00', '12:00-17:00'],
  );
});

test('today starts from "now" when now is during work hours', () => {
  const mon = DateTime.fromISO('2026-04-27T11:20', { zone: 'Europe/London' });
  const result = computeFreeSlots({ busy: [], now: mon });
  const today = result.days.find((d) => d.date === '2026-04-27');
  assert.equal(today.slots.length, 1);
  assert.equal(today.slots[0].startLabel, '11:20');
});

test('today is dropped when "now" is past the work window', () => {
  const mon = DateTime.fromISO('2026-04-27T18:00', { zone: 'Europe/London' });
  const result = computeFreeSlots({ busy: [], now: mon });
  const today = result.days.find((d) => d.date === '2026-04-27');
  assert.equal(today, undefined);
});

test('free gap shorter than MIN_SLOT_MINUTES is dropped', () => {
  // MIN_SLOT_MINUTES=15 from setup; the 10-minute gap below should be dropped.
  const mon = DateTime.fromISO('2026-04-27T06:00', { zone: 'Europe/London' });
  const busy = [
    { start: '2026-04-27T09:00:00+01:00', end: '2026-04-27T11:00:00+01:00' },
    { start: '2026-04-27T11:10:00+01:00', end: '2026-04-27T17:00:00+01:00' },
  ];
  const result = computeFreeSlots({ busy, now: mon });
  const today = result.days.find((d) => d.date === '2026-04-27');
  assert.equal(today.slots.length, 0);
});

test('buildWorkingWindows respects DAYS_AHEAD and weekday filter', () => {
  const mon = DateTime.fromISO('2026-04-27T06:00', { zone: 'Europe/London' });
  const windows = buildWorkingWindows(mon);
  assert.equal(windows.length, 5);
});
