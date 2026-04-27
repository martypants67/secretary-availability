# Secretary Availability Widget

A small Node.js service + embeddable JavaScript widget that publishes a medical
secretary's free time on your website, sourced from her Google Workspace
calendar via the **freebusy** API.

- **Privacy-preserving** — only "busy" time blocks are read, never event
  titles, attendees, or descriptions. Suitable for a clinical setting.
- **Working window** — by default Mon–Fri 09:00–17:00 in the clinic's
  timezone. Configurable via env vars.
- **Display only** — does not allow booking. Clients see when she is free
  to take a phone call.

## How it works

1. A backend service authenticates as a Google Cloud service account with
   **domain-wide delegation**, impersonates the secretary's Workspace user, and
   calls `calendar.freebusy.query`.
2. Returned busy blocks are subtracted from the working window (e.g. Mon–Fri
   09:00–17:00 local time) over the next N days.
3. The result is cached for a couple of minutes and exposed at
   `GET /api/availability` as JSON.
4. A small `widget.js` file fetches that JSON and renders a styled list of free
   slots that you embed on your website with two lines of HTML.

## Setup

### 1. Create a Google Cloud project & service account

You'll do this once, as the Workspace admin.

1. Go to <https://console.cloud.google.com> and create (or pick) a project.
2. Enable the **Google Calendar API** for that project.
3. Under **IAM & Admin → Service Accounts**, create a new service account
   (e.g. `secretary-freebusy`). No project-level roles are required.
4. Open the new service account → **Keys → Add key → JSON**. Save the file as
   `config/service-account.json` in this project. **Do not commit it** — it's
   already in `.gitignore`.
5. On the service account's **Details** page note the **Unique ID** (a long
   number) — you'll need it in the next step.

### 2. Authorize domain-wide delegation in Workspace

This lets the service account impersonate the secretary's user *for the
calendar.readonly scope only*.

1. Go to <https://admin.google.com> → **Security → Access and data control →
   API controls → Manage Domain Wide Delegation**.
2. Click **Add new**.
3. **Client ID** = the service account's Unique ID from step 1.5.
4. **OAuth scopes** = `https://www.googleapis.com/auth/calendar.readonly`
5. Save.

The service account can now read freebusy for any user in your Workspace
*for the read-only calendar scope only* — nothing else.

### 3. Configure

```bash
cp .env.example .env
# Edit .env and set:
#   SECRETARY_EMAIL=secretary@yourclinic.example
#   TIMEZONE=Europe/London   (or whatever your clinic uses)
```

### 4. Install and run

```bash
npm install
npm start
```

Open <http://localhost:3000/> for the demo page, or hit
<http://localhost:3000/api/availability> directly to see the JSON.

### 5. Embed on your website

Once you've deployed the service to a public URL (see below), add this to any
page on your website:

```html
<div id="secretary-availability"></div>
<script src="https://YOUR-HOST/widget.js"
        data-endpoint="https://YOUR-HOST/api/availability"
        data-target="secretary-availability"></script>
```

Lock down `ALLOWED_ORIGINS` in `.env` to your website's origin once you go
live (e.g. `ALLOWED_ORIGINS=https://yourclinic.example`).

## Configuration reference

All settings are in `.env`. Defaults shown.

| Variable | Default | Notes |
|---|---|---|
| `SECRETARY_EMAIL` | *(required)* | Workspace email of the calendar to read |
| `GOOGLE_APPLICATION_CREDENTIALS` | *(required)* | Path to service account JSON |
| `TIMEZONE` | `UTC` | IANA tz, e.g. `Europe/London` |
| `WORK_START_HOUR` | `9` | Inclusive, 24h, local clinic time |
| `WORK_END_HOUR` | `17` | Exclusive |
| `WORK_DAYS` | `1,2,3,4,5` | ISO weekdays (1=Mon, 7=Sun) |
| `DAYS_AHEAD` | `14` | How many days of availability to publish |
| `MIN_SLOT_MINUTES` | `15` | Drop free gaps shorter than this |
| `CACHE_TTL_SECONDS` | `120` | How long to cache freebusy responses |
| `PORT` | `3000` | HTTP port |
| `ALLOWED_ORIGINS` | `*` | CORS allowlist; comma-separated |

## API

### `GET /api/availability`

```jsonc
{
  "timezone": "Europe/London",
  "workStartHour": 9,
  "workEndHour": 17,
  "workDays": [1, 2, 3, 4, 5],
  "generatedAt": "2026-04-27T11:42:00.000+01:00",
  "days": [
    {
      "date": "2026-04-27",
      "weekday": "Monday",
      "dateLabel": "27 Apr",
      "slots": [
        { "start": "...", "end": "...", "startLabel": "09:00", "endLabel": "10:30", "durationMinutes": 90 },
        { "start": "...", "end": "...", "startLabel": "14:00", "endLabel": "17:00", "durationMinutes": 180 }
      ]
    }
  ]
}
```

## Deployment notes

Any Node 20+ host works. A few common options:

- **Google Cloud Run** — natural fit since the service account already lives
  in GCP. Mount the JSON key via Secret Manager rather than baking it into the
  image.
- **Fly.io / Render / Railway** — set the env vars and upload the JSON key as
  a secret file.
- Behind a reverse proxy (nginx, Cloudflare) is fine; the widget just needs
  HTTPS access to `/api/availability` and `/widget.js`.

## Security

- The service account JSON key is the only secret. Treat it like a password.
  Rotate it from the Cloud Console if it leaks.
- Domain-wide delegation is scoped to **`calendar.readonly`** only — the
  service account cannot modify any calendar, send mail, read Drive, etc.
- `freebusy.query` returns only opaque busy intervals, so even if the JSON
  endpoint is fully public it cannot leak appointment subjects or attendees.
- Set `ALLOWED_ORIGINS` to your website origin in production to keep other
  sites from hot-linking the JSON.
