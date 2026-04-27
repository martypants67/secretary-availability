import { google } from 'googleapis';
import { config } from './config.js';

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

function buildAuth() {
  return new google.auth.GoogleAuth({
    keyFile: config.credentialsPath,
    scopes: SCOPES,
    clientOptions: { subject: config.secretaryEmail },
  });
}

const auth = buildAuth();
const calendar = google.calendar({ version: 'v3', auth });

export async function fetchBusyBlocks({ timeMin, timeMax }) {
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISO(),
      timeMax: timeMax.toISO(),
      timeZone: config.timezone,
      items: [{ id: config.secretaryEmail }],
    },
  });

  const cal = res.data.calendars?.[config.secretaryEmail];
  if (!cal) {
    throw new Error(`No calendar data returned for ${config.secretaryEmail}`);
  }
  if (cal.errors && cal.errors.length > 0) {
    const messages = cal.errors.map((e) => `${e.domain || '?'}:${e.reason || '?'}`).join(', ');
    throw new Error(`Google returned errors for ${config.secretaryEmail}: ${messages}`);
  }
  return cal.busy || [];
}
