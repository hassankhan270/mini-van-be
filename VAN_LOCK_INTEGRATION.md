# Van Lock/Unlock — Frontend Integration

Reference for integrating the simulated van lock feature. This is a **simulated** lock — no real vehicle, no hardware. It's just a boolean (`isLocked`) on a reservation that the customer toggles from the app, the same interaction pattern as a real rental-car app's remote lock button.

## What it means

- `isLocked: false` → van is unlocked.
- `isLocked: true` → van is locked.
- Every new reservation starts **unlocked** (`isLocked: false`).
- The customer who made the reservation is the one who locks/unlocks it — this is a customer-facing feature, not an admin one. No auth/token required on this endpoint.

## The endpoint

```
PATCH /reservations/:id/lock
```

- No request body.
- It's a pure **toggle** — it flips whatever the current value is. There's no "set to locked" vs "set to unlocked" call, just one action that flips state each time it's called.

### Rules

Only works while **today's date is within the reservation's rental window** (`startDate` ≤ today ≤ `endDate`). Outside that window, the request is rejected — the state just stays as it was.

| Timing | Result |
|---|---|
| Before `startDate` (rental hasn't started) | `403 Forbidden` |
| Between `startDate` and `endDate` (active rental) | `200` — toggles and returns the updated reservation |
| After `endDate` (rental is over) | `403 Forbidden` |

### Responses

**`200`** — success, returns the full updated reservation:
```json
{
  "id": "e6372e7b-b322-4593-8971-97d9c6590c0b",
  "van": { "...": "..." },
  "vanId": "fe7911bf-86c6-4ab3-94ac-87d83b1345e5",
  "startDate": "2026-11-10",
  "endDate": "2026-11-15",
  "customerName": "Jane Doe",
  "customerEmail": "jane@example.com",
  "customerPhone": "555-1234",
  "isLocked": true,
  "createdAt": "2026-10-31T00:17:13.911Z"
}
```

**`400`** — `id` is not a valid UUID.

**`403`** — outside the rental window:
```json
{
  "statusCode": 403,
  "message": "Lock can only be toggled during the active rental period",
  "error": "Forbidden",
  "timestamp": "...",
  "path": "/reservations/.../lock"
}
```

**`404`** — reservation doesn't exist.

## UI behavior

1. On the reservation/booking detail screen, read `isLocked`, `startDate`, `endDate` from the reservation you already have (`GET /reservations/:id`, or whatever you fetched to land on this screen).
2. Compute whether today is inside `[startDate, endDate]` **client-side first**, to decide whether to show the button as enabled, disabled, or hidden:
   ```js
   const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
   const isActiveRental = today >= reservation.startDate && today <= reservation.endDate;
   ```
3. Button label/icon should reflect current state: show "Lock van" when `isLocked === false`, "Unlock van" when `isLocked === true`.
4. On tap, call the endpoint and replace your local reservation state with the response body (don't just flip the boolean optimistically and assume success — use the server's returned `isLocked`).
5. Still handle a `403` from the server even if your client-side check said it should be allowed (e.g. the window closed between page load and the tap, or clocks differ) — show a message like "This booking is no longer in its rental period" and disable the button.

## Example (fetch)

```js
async function toggleVanLock(reservationId) {
  const res = await fetch(`${API_BASE}/reservations/${reservationId}/lock`, {
    method: 'PATCH',
  });

  if (res.status === 403) {
    throw new Error('Lock can only be toggled during your active rental period.');
  }
  if (!res.ok) {
    throw new Error('Could not update lock state.');
  }

  const reservation = await res.json();
  return reservation.isLocked; // use this to update your UI
}
```

## Where this fits in the booking flow

```
Book a van → Confirmation screen → (during rental dates) Reservation detail screen
                                                              └─ Lock/Unlock button → PATCH /reservations/:id/lock
```

See [FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md) for the full API contract and [the flow map](https://claude.ai/artifact/4HkWfj6VtMsGgKoCKgDsXV) for the full screen walkthrough.
