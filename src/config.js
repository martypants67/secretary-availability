import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) throw new Error(`Env var ${name} must be an integer, got: ${raw}`);
  return n;
}

function csvIntEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw.split(',').map((s) => {
    const n = Number.parseInt(s.trim(), 10);
    if (Number.isNaN(n)) throw new Error(`Env var ${name} contains a non-integer: ${s}`);
    return n;
  });
}

export const config = {
  secretaryEmail: required('SECRETARY_EMAIL'),
  credentialsPath: required('GOOGLE_APPLICATION_CREDENTIALS'),
  timezone: process.env.TIMEZONE || 'UTC',
  workStartHour: intEnv('WORK_START_HOUR', 9),
  workEndHour: intEnv('WORK_END_HOUR', 17),
  workDays: csvIntEnv('WORK_DAYS', [1, 2, 3, 4, 5]),
  daysAhead: intEnv('DAYS_AHEAD', 14),
  minSlotMinutes: intEnv('MIN_SLOT_MINUTES', 15),
  cacheTtlSeconds: intEnv('CACHE_TTL_SECONDS', 120),
  port: intEnv('PORT', 3000),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
