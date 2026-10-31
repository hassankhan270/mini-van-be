# Frontend Integration Guide

API reference for building the UI against the Mini Van Rental backend. See the [flow map](https://claude.ai/artifact/4HkWfj6VtMsGgKoCKgDsXV) for the screen-by-screen walkthrough — this doc is the request/response contract.

## Base URL

```
http://localhost:8080
```

Set `PORT` in the backend's `.env` if 8080 is taken by something else (e.g. a local Next.js dev server). CORS is open, so the frontend can run on any port/origin.

## Conventions

- All dates are whole calendar days, format `YYYY-MM-DD` (no time component).
- A van can be picked up the same day another booking returns it — same-day turnover is allowed. Any other date overlap is rejected.
- Every error response has the shape:
  ```json
  { "statusCode": 400, "message": "...", "error": "Bad Request", "timestamp": "...", "path": "/..." }
  ```
  `message` can be a string or an array of strings (validation errors).
- Admin write actions require a JWT (see **Admin auth** below). Everything else — browsing vans, checking availability, booking, looking up a single reservation, toggling lock/unlock — is open, no login needed.

---

## Admin auth

### `POST /auth/login`

**Body** — `username` holds the admin's email (field name kept as `username` for a generic login form):
```json
{ "username": "admin@example.com", "password": "..." }
```

**Response `200`**
```json
{ "accessToken": "eyJhbGciOi..." }
```
- `401` — wrong email/password.

Admin accounts are rows in the database (not env config), added directly by whoever runs the backend — there's no public sign-up endpoint.

Token is a JWT, valid 1 day. Send it on protected requests as:
```
Authorization: Bearer <accessToken>
```
Store it in memory or `sessionStorage` for the admin session (not `localStorage` long-term — there's no refresh/logout flow yet, just re-login when it expires). A request to a protected route without a valid token gets `401 { "statusCode": 401, "message": "Unauthorized" }`.

**Protected routes:** `POST /vans`, `PATCH /vans/:id`, `DELETE /vans/:id`, `PATCH /vans/:id/image`, `GET /reservations`. Everything else is public.

---

## `GET /vans?type`

List all vans. Optional `type` filter: `van` or `bus`.

**Response `200`**
```json
[
  {
    "id": "fe7911bf-86c6-4ab3-94ac-87d83b1345e5",
    "name": "Compact Camper Van",
    "description": "Cozy 2-berth camper with a pop-up bed and mini kitchenette, perfect for weekend getaways.",
    "imageUrl": "https://res.cloudinary.com/dfh4q0rct/image/upload/v1793426005/mini-van-rentals/compact-camper-van.jpg",
    "type": "van",
    "pricePerDay": 89,
    "createdAt": "2026-10-31T00:04:08.560Z"
  }
]
```
- `400` — `type` given but not `van`/`bus`.

Every vehicle has a `type`: `"van"` or `"bus"` (e.g. passenger minibuses/shuttles). Defaults to `"van"` if not set on create. Use this to split the fleet listing into tabs/categories.

## `GET /vans/:id`

Single van.

- `200` — van object (same shape as above).
- `400` — `id` is not a valid UUID.
- `404` — van doesn't exist.

## `GET /vans/available?startDate&endDate&type`

Bulk version of the availability check: returns only the vans that are free for the whole given date range, in one request — use this for a fleet-wide date filter instead of calling `/reservations/availability` once per van. Optional `type` filter (`van`/`bus`) combines with the date filter.

**Query params:** `startDate`, `endDate` — both required.

**Response `200`** — array of vans (same shape as `GET /vans`), only the ones free for that range.

- `400` — missing/malformed params, or `endDate <= startDate`, or `startDate` in the past.

Same-day turnover applies here too: a van is considered available starting on the day another booking returns it.

## `POST /vans` 🔒

Create a van. Requires `Authorization: Bearer <accessToken>`.

**Body**
```json
{ "name": "Weekend Camper", "description": "...", "pricePerDay": 95, "imageUrl": "https://...", "type": "van" }
```
`imageUrl` and `type` are both optional — `imageUrl` defaults to a placeholder (upload a real photo afterward via `PATCH /vans/:id/image`), `type` defaults to `"van"`.

**Response `201`** — the created van.
- `400` — validation failure (including `type` not being `van`/`bus`).
- `401` — missing/invalid token.

## `PATCH /vans/:id` 🔒

Update a van's `name`, `description`, `pricePerDay`, and/or `type` (all optional, partial update). Requires auth.

**Response `200`** — the updated van.
- `400` — validation failure or invalid UUID.
- `401` — missing/invalid token.
- `404` — van doesn't exist.

## `DELETE /vans/:id` 🔒

Delete a van. Requires auth.

**Response `204`** — no body.
- `401` — missing/invalid token.
- `404` — van doesn't exist.
- `409` — van has reservations attached; can't delete (remove/complete those first).

## `PATCH /vans/:id/image` 🔒

Upload/replace a van's photo. Requires auth. Backend uploads it to Cloudinary and saves the resulting URL on the van.

**Body** — `multipart/form-data`, field name `image`, max 5MB, must be an image mimetype.

**Response `200`** — the updated van object with the new `imageUrl`.

- `400` — no file provided, or file isn't an image.
- `401` — missing/invalid token.
- `404` — van doesn't exist.

---

## `GET /reservations/booked-dates?vanId`

Returns every date range already booked for a van — **no customer data**, just `startDate`/`endDate` pairs. Use this to grey out/disable already-reserved dates in the date picker *before* the user tries to pick them, instead of only catching the conflict after they submit.

**Query params:** `vanId` (uuid) — required.

**Response `200`**
```json
[
  { "startDate": "2026-11-10", "endDate": "2026-11-15" },
  { "startDate": "2026-12-01", "endDate": "2026-12-05" }
]
```

- `400` — `vanId` missing or not a valid UUID.
- `404` — van doesn't exist.

Remember same-day turnover is allowed: a range ending `2026-11-15` doesn't block `2026-11-15` as a new start date, only dates strictly inside `[startDate, endDate)`.

## `GET /reservations/availability?vanId&startDate&endDate`

Check whether a specific candidate date range is free. Call this right before `POST /reservations` as the final check — `booked-dates` is for rendering the calendar, this is for validating the exact selection (and the backend re-checks again on submit regardless).

**Query params:** `vanId` (uuid), `startDate`, `endDate` — all required.

**Response `200`**
```json
{ "available": true }
```

- `400` — missing/malformed params, or `endDate <= startDate`, or `startDate` in the past.
- `404` — van doesn't exist.

## `POST /reservations`

Create a booking. **Always handle a `409` here even if the availability check just said `true`** — someone else may have booked the same slot in between; show a message and send the user back to pick new dates.

**Body**
```json
{
  "vanId": "fe7911bf-86c6-4ab3-94ac-87d83b1345e5",
  "startDate": "2026-11-10",
  "endDate": "2026-11-15",
  "customerName": "Jane Doe",
  "customerEmail": "jane@example.com",
  "customerPhone": "555-1234"
}
```

**Response `201`** — the created reservation, with `van` joined:
```json
{
  "id": "e6372e7b-b322-4593-8971-97d9c6590c0b",
  "van": { "id": "...", "name": "...", "description": "...", "imageUrl": "...", "pricePerDay": 89, "createdAt": "..." },
  "vanId": "fe7911bf-86c6-4ab3-94ac-87d83b1345e5",
  "startDate": "2026-11-10",
  "endDate": "2026-11-15",
  "customerName": "Jane Doe",
  "customerEmail": "jane@example.com",
  "customerPhone": "555-1234",
  "isLocked": false,
  "createdAt": "2026-10-31T00:17:13.911Z"
}
```

- `400` — validation failure (bad email, missing fields, `endDate <= startDate`, `startDate` in the past).
- `404` — van doesn't exist.
- `409` — dates overlap an existing reservation for that van.

## `GET /reservations?vanId&type&startDate&endDate` 🔒

Admin dashboard data — all reservations, van joined, sorted by `startDate` ascending. All query params are optional filters, and can be combined:
- `vanId` — one specific van.
- `type` — `van` or `bus`, filters by vehicle type (use this for a "Vans / Buses" toggle instead of a per-van name filter).
- `startDate`+`endDate` together — reservations that overlap that range.

Requires auth.

**Response `200`** — array of reservation objects (same shape as the `POST` response).
- `400` — `type` given but not `van`/`bus`.
- `401` — missing/invalid token.

## `GET /reservations/:id`

Single reservation, van joined.

- `200` — reservation object.
- `400` — invalid UUID.
- `404` — not found.

## `PATCH /reservations/:id/lock`

Toggle the simulated lock on a reservation's van. No request body — it's a pure flip of the current state.

Only allowed while **today falls inside `[startDate, endDate]`** of that reservation. Disable or hide the control in the UI outside that window rather than relying only on the error.

**Response `200`** — updated reservation, with the new `isLocked` value.

- `400` — invalid UUID.
- `403` — today is outside the reservation's rental window.
- `404` — not found.

---

## Suggested client flow

**Customer side (no login):**
1. `GET /vans` → render listing.
2. User opens a van's detail page → `GET /reservations/booked-dates?vanId=...` → disable those date ranges in the calendar.
3. User picks remaining dates → `GET /reservations/availability` → final confirmation before showing the form.
4. If available, show the contact form → `POST /reservations` on submit.
5. On `409`, tell the user the dates were just taken, re-fetch `booked-dates` to refresh the calendar, and let them pick again.
6. On `201`, show a confirmation with the reservation `id`.
7. Reservation detail: show the lock/unlock button only when `today` is within `[startDate, endDate]`; call `PATCH /reservations/:id/lock` on tap.

**Admin side (login required):**
1. Login screen → `POST /auth/login` → store the `accessToken`.
2. Dashboard → `GET /reservations` (with the token) on load, optionally with filters.
3. Fleet management → `POST /vans` to add, `PATCH /vans/:id` to edit details, `PATCH /vans/:id/image` to set the photo, `DELETE /vans/:id` to remove (blocked with `409` if it has reservations).
4. On any `401` from a protected call, send the admin back to the login screen.
