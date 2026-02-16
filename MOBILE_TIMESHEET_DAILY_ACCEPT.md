# Mobile App: Daily Timesheet Acceptance Workflow

## Overview

The timesheet approval workflow has been updated to support **daily acceptance** during the fortnight period, with **final approval** only available on the last day of the fortnight.

## New Workflow

### During the Fortnight (before last day)

- Supervisors can **Accept** or **Reject** the timesheet for the current day
- This allows supervisors to review and accept work daily as it happens
- Status transitions: `SUBMITTED` → `ACCEPTED`

### On/After the Last Day of the Fortnight

- Supervisors can **Final Approve** or **Reject** the entire timesheet
- Status transitions: `SUBMITTED`/`ACCEPTED` → `APPROVED` or `REJECTED`

## New TimesheetStatus Values

```typescript
enum TimesheetStatus {
  SUBMITTED  // Initial state after foreman submits
  ACCEPTED   // Daily acceptance during fortnight (NEW)
  APPROVED   // Final approval on last day
  REJECTED   // Rejected by supervisor
  PAID       // Marked as paid
}
```

## New API Endpoints

### 1. Accept/Reject Day

**POST** `/api/app/supervisor/timesheets/{id}/accept-day`
**POST** `/api/app/supervisor/timesheets/{id}/accept-day?siteId={siteId}`

Accepts or rejects a specific day of the timesheet during the fortnight period.

**ID Formats:**

- `YYYY-MM-DD_YYYY-MM-DD_FOREMANID_SITEID` (siteId in path)
- `YYYY-MM-DD_YYYY-MM-DD__FOREMANID?siteId=...` (siteId as query param)

**Request Body:**

```json
{
  "date": "2026-02-16", // ISO date string (YYYY-MM-DD) - required
  "action": "accept", // "accept" or "reject" - required
  "reason": "string" // Required only when action is "reject"
}
```

**Response (Success - 200):**

```json
{
  "message": "Day 2026-02-16 accepted successfully",
  "dayAcceptance": {
    "id": "cm...",
    "workDate": "2026-02-16T00:00:00.000Z",
    "status": "ACCEPTED",
    "acceptedAt": "2026-02-16T14:30:00.000Z",
    "acceptedBySupervisorId": "sup123"
  },
  "timesheetStatus": "ACCEPTED"
}
```

**Response (Reject - 200):**

```json
{
  "message": "Day 2026-02-16 rejected",
  "dayAcceptance": {
    "id": "cm...",
    "workDate": "2026-02-16T00:00:00.000Z",
    "status": "REJECTED",
    "rejectedAt": "2026-02-16T14:30:00.000Z",
    "rejectionReason": "Missing workers"
  },
  "timesheetStatus": "ACCEPTED"
}
```

**Errors:**

- `400` - Invalid date format, missing required fields, or date outside fortnight period
- `401` - Unauthorized
- `403` - Forbidden (not ADMIN or SUPERVISOR)
- `404` - Timesheet not found
- `409` - Timesheet not in valid status for daily acceptance

---

### 2. Get Day Acceptances

**GET** `/api/app/supervisor/timesheets/{id}/day-acceptances`
**GET** `/api/app/supervisor/timesheets/{id}/day-acceptances?siteId={siteId}`

Retrieves all day acceptance records for a timesheet.

**ID Formats:**

- `YYYY-MM-DD_YYYY-MM-DD_FOREMANID_SITEID` (siteId in path)
- `YYYY-MM-DD_YYYY-MM-DD__FOREMANID?siteId=...` (siteId as query param)

**Response (Success - 200):**

```json
{
  "timesheetId": "2026-02-02_2026-02-15_foreman123_site456",
  "timesheetStatus": "ACCEPTED",
  "dayAcceptances": [
    {
      "id": "cm...",
      "workDate": "2026-02-02",
      "status": "ACCEPTED",
      "acceptedAt": "2026-02-02T17:00:00.000Z",
      "acceptedBySupervisorId": "sup123",
      "rejectedAt": null,
      "rejectionReason": null
    },
    {
      "id": "cm...",
      "workDate": "2026-02-03",
      "status": "REJECTED",
      "acceptedAt": null,
      "acceptedBySupervisorId": null,
      "rejectedAt": "2026-02-03T18:00:00.000Z",
      "rejectionReason": "Missing documentation"
    }
  ]
}
```

---

### 3. Final Approve (Updated)

**POST** `/api/app/supervisor/timesheets/{id}/approve`

Now **only works on or after the last day of the fortnight period**.

**Error when called too early:**

```json
{
  "error": "Cannot approve timesheet before the last day of the fortnight. Use daily Accept instead.",
  "lastDay": "2026-02-15"
}
```

---

## Timesheet ID Format

The timesheet ID now includes the site ID:

```
{startDate}_{endDate}_{foremanId}_{siteId}
```

Example: `2026-02-02_2026-02-15_foreman123_site456`

---

## Mobile UI Recommendations

### Timesheet List Screen

- Show status badge with new `ACCEPTED` status (use orange/yellow color)
- Display acceptance progress indicator (e.g., "8/14 days accepted")

### Timesheet Detail Screen

**During Fortnight (before last day):**

- Show "Accept Today" button (primary action)
- Show "Reject Today" button (destructive action, requires reason dialog)
- Display calendar/list view showing which days have been accepted/rejected
- Color code days: green (accepted), red (rejected), gray (pending)

**On/After Last Day:**

- Show "Final Approve" button (primary action)
- Show "Reject" button (destructive action, requires reason)
- Hide daily accept/reject buttons

### Day Acceptance Indicators

```
┌─────────────────────────────────────┐
│ Mon 02 Feb  │  ✓ Accepted  │ 17:00 │
│ Tue 03 Feb  │  ✗ Rejected  │ 18:00 │
│ Wed 04 Feb  │  ○ Pending   │   -   │
│ ...                                 │
└─────────────────────────────────────┘
```

### Status Badge Colors

- `SUBMITTED` - Blue
- `ACCEPTED` - Orange/Yellow (partially accepted)
- `APPROVED` - Green
- `REJECTED` - Red
- `PAID` - Purple/Gray

---

## Date Logic for UI

```typescript
// Determine which buttons to show
const today = new Date().toISOString().slice(0, 10); // "2026-02-16"
const { startISO, endISO } = parseTimesheetId(timesheetId);

const isLastDayOrLater = today >= endISO;
const isWithinPeriod = today >= startISO && today <= endISO;

if (isWithinPeriod && !isLastDayOrLater) {
  // Show: "Accept Today", "Reject Today"
  // Hide: "Final Approve", "Reject"
} else if (isLastDayOrLater) {
  // Show: "Final Approve", "Reject"
  // Hide: "Accept Today", "Reject Today"
}
```

---

## Authentication

All endpoints require Bearer token authentication:

```
Authorization: Bearer <jwt_token>
```

The token must belong to a user with role `ADMIN` or `SUPERVISOR`.
