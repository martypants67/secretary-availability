import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DateTime } from 'luxon';
import { config } from './config.js';
import { fetchBusyBlocks } from './google.js';
import { computeFreeSlots } from './availability.js';
import { createCache } from './cache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const cache = createCache(config.cacheTtlSeconds);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowAll = config.allowedOrigins.includes('*');
  if (allowAll) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && config.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.get('/api/availability', async (_req, res) => {
  try {
    const data = await cache.get(async () => {
      const now = DateTime.now().setZone(config.timezone);
      const timeMin = now.startOf('day');
      const timeMax = now.startOf('day').plus({ days: config.daysAhead });
      const busy = await fetchBusyBlocks({ timeMin, timeMax });
      return computeFreeSlots({ busy, now });
    });
    res.setHeader('Cache-Control', `public, max-age=${config.cacheTtlSeconds}`);
    res.json(data);
  } catch (err) {
    console.error('availability failed:', err);
    res.status(502).json({ error: 'Failed to fetch availability' });
  }
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(config.port, () => {
  console.log(`Secretary availability server listening on :${config.port}`);
  console.log(`Calendar: ${config.secretaryEmail} | TZ: ${config.timezone}`);
});
