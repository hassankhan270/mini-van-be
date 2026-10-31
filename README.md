# Mini Van Rental — Backend

NestJS + TypeORM + PostgreSQL backend for a van rental booking system.

## Features

- **Vehicle listing** — 3 vans auto-seeded on first boot (`GET /vans`), real photos hosted on Cloudinary.
- **Availability check** — look up whether a van is free for a date range before booking.
- **Booking** — create a reservation; the backend re-validates availability inside a DB transaction (with a row lock) and backs it with a Postgres `EXCLUDE` constraint, so two concurrent requests can't double-book the same van.
- **Admin auth** — JWT login (`POST /auth/login`) gates fleet management and the reservations dashboard.
- **Admin fleet management** — create/edit/delete vans and upload van photos (uploads go to Cloudinary).
- **Admin dashboard data** — `GET /reservations` lists every booking (requires login).
- **Lock/unlock (bonus)** — `PATCH /reservations/:id/lock` toggles a simulated lock, but only while today falls inside that reservation's rental window.

## Setup

```bash
npm install
cp .env.example .env   # fill in the values below
npm run start:dev
```

Required env vars (see `.env.example`):
- `DATABASE_URL` — SSL-enabled Postgres connection string (Neon, Supabase, RDS, etc.). Schema syncs automatically on boot (`synchronize: true`), and the 3 sample vans seed themselves if the `vans` table is empty.
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` — used for van photo uploads (`PATCH /vans/:id/image`).
- `JWT_SECRET` — signs admin session tokens.

### Admin accounts

Admins live in the `admins` table (`email`, `passwordHash`), not in env vars — there's no self-registration endpoint, so add one directly:

```bash
node -e "
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
client.connect().then(async () => {
  const hash = bcrypt.hashSync('your-password', 10);
  await client.query(
    'INSERT INTO admins (email, \"passwordHash\") VALUES (\$1, \$2) ON CONFLICT (email) DO UPDATE SET \"passwordHash\" = EXCLUDED.\"passwordHash\"',
    ['admin@example.com', hash]
  );
  await client.end();
});
"
```
Run this once the app has booted at least once (so the `admins` table exists), then log in via `POST /auth/login`.

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/vans?type` | — | List all vans (optional `type` filter: `van`/`bus`) |
| `GET` | `/vans/:id` | — | Get one van |
| `GET` | `/vans/available?startDate&endDate&type` | — | List vans free for a date range (bulk, fleet filter) |
| `POST` | `/vans` | 🔒 | Create a van |
| `PATCH` | `/vans/:id` | 🔒 | Update name/description/price/type |
| `DELETE` | `/vans/:id` | 🔒 | Delete a van (blocked if it has reservations) |
| `PATCH` | `/vans/:id/image` | 🔒 | Upload a van photo (multipart, field `image`) |
| `POST` | `/auth/login` | — | Get an admin JWT (`{ username, password }` → `{ accessToken }`) |
| `GET` | `/reservations/booked-dates?vanId` | — | List a van's already-booked date ranges (for calendar blocking) |
| `GET` | `/reservations/availability?vanId&startDate&endDate` | — | Check if a van is free for a date range |
| `POST` | `/reservations` | — | Create a booking (`vanId`, `startDate`, `endDate`, `customerName`, `customerEmail`, `customerPhone`) |
| `GET` | `/reservations?vanId&type&startDate&endDate` | 🔒 | List all reservations (admin), optional filters incl. vehicle `type` |
| `GET` | `/reservations/:id` | — | Get one reservation |
| `PATCH` | `/reservations/:id/lock` | — | Toggle the simulated lock (only during the active rental period) |

🔒 routes require `Authorization: Bearer <accessToken>` from `POST /auth/login`.

Dates are whole calendar days (`YYYY-MM-DD`). A van can be picked up the same day another booking returns it (same-day turnover is allowed); any other date overlap is rejected with `409`.

See [FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md) for full request/response shapes and a suggested client flow.

## Tests

```bash
npm run test       # unit tests — overlap logic, date validation, lock window, auth
npm run test:e2e   # end-to-end, needs a reachable DATABASE_URL
```
