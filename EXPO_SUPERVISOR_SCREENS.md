# Expo Supervisor App - Screen Design Guide

## Overview

Supervisors need to view and manage timesheets submitted by their foremen. They can approve, reject, or mark timesheets as paid.

---

## 📱 Recommended Screens

### 1. **Home/Dashboard Screen**

**Purpose:** Quick overview of supervisor's responsibilities
**Data to show:**

- Supervisor name & role
- Summary stats: (e.g., Pending timesheets, Approved, Paid)
- Quick action button to view timesheets

**No API needed** - Just display logged-in user info from auth token

---

### 2. **Timesheets List Screen** ⭐ (Primary)

**Purpose:** Browse all timesheets assigned to supervisor's foremen
**API Endpoint:** `GET /api/app/supervisor/timesheets`

**Query Parameters:**

- `period` (optional): `YYYY-MM-DD_YYYY-MM-DD` - Filter by fortnight (default: current)
- `q` (optional): Search by foreman name
- `status` (optional): `ALL`, `SUBMITTED`, `APPROVED`, `REJECTED`, `PAID`

**Response Data:**

```typescript
{
  timesheets: [
    {
      id: "2026-01-26_2026-02-08__foreman-123", // Use this ID for detail view
      startISO: "2026-01-26",
      endISO: "2026-02-08",
      foreman: { id, name },
      status: "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID",
      totalWorkerDays: number,
      totalWorkerWages: number,
      sites: [{ id, code, name }],
    },
  ];
}
```

**UI Elements:**

- Search bar (foreman name)
- Filter buttons: All, Submitted, Approved, Rejected, Paid
- Period selector (current fortnight default)
- Table/List view with:
  - Foreman name
  - Fortnight range
  - Status badge
  - Days worked
  - Total wages
  - Row clickable → Detail view

---

### 3. **Timesheet Detail Screen** ⭐ (Secondary)

**Purpose:** View full timesheet grid and take action
**API Endpoint:** `GET /api/app/supervisor/timesheets/{id}`

**Path Parameter:**

- `id`: `YYYY-MM-DD_YYYY-MM-DD__foreman-id` (from list screen)

**Response Data:**

```typescript
{
  timesheet: {
    id: string,
    startISO: "2026-01-26",
    endISO: "2026-02-08",
    status: "SUBMITTED",
    foreman: { id, name },
    supervisor: { id, name },
    sites: [{ id, code, name }],
    rows: [
      {
        employeeId: string,
        employeeName: string,
        dailyAttendance: [
          { date: "2026-01-26", present: true },
          { date: "2026-01-27", present: false },
          // ... 14 day entries
        ],
        totalDays: number,
        totalWages: number
      }
    ],
    columns: [
      { type: "date", label: "Sat 26", date: "2026-01-26" },
      { type: "date", label: "Sun 27", date: "2026-01-27" },
      // ... 14 date columns
    ]
  }
}
```

**UI Elements:**

- Header info: Foreman, Supervisor, Sites, Fortnight range
- Grid/Table: 14-day attendance grid (similar to web)
- Action buttons (based on status):
  - ✅ **Approve** (enabled if status="SUBMITTED")
  - ❌ **Reject** (enabled if status="SUBMITTED") - Opens dialog for reason
  - 💳 **Mark Paid** (enabled if status="APPROVED")
  - 🔄 **Refresh** button

---

## 🔌 Action Endpoints

### Approve Timesheet

**POST** `/api/app/supervisor/timesheets/{id}/approve`

- **Auth:** Bearer token (SUPERVISOR role)
- **Body:** None
- **Response:** `{ ok: true, status: "APPROVED", approvedAt: ISO-date }`
- **Status:** 200 (success), 400 (wrong status), 403 (forbidden)

### Reject Timesheet

**POST** `/api/app/supervisor/timesheets/{id}/reject`

- **Auth:** Bearer token (SUPERVISOR role)
- **Body:** `{ reason: string }`
- **Response:** `{ ok: true, status: "REJECTED", rejectedAt: ISO-date }`
- **Status:** 200 (success), 400 (wrong status), 403 (forbidden)

### Mark as Paid

**POST** `/api/app/supervisor/timesheets/{id}/paid`

- **Auth:** Bearer token (SUPERVISOR role)
- **Body:** None
- **Response:** `{ ok: true, status: "PAID", paidAt: ISO-date }`
- **Status:** 200 (success), 400 (wrong status), 403 (forbidden)

---

## 📊 Data Flow Architecture

```
┌─────────────────────────────────────┐
│   Supervisor Logs In                │
│   (Receives Bearer JWT token)        │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   Home/Dashboard Screen             │
│   (Display user info, stats)        │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   GET /api/app/supervisor/timesheets│
│   (List screen - search, filter)    │
└────────────┬────────────────────────┘
             │
      (User clicks row)
             │
             ▼
┌─────────────────────────────────────┐
│   GET /api/app/supervisor/timesheets│
│   /{id} (Detail screen - grid view) │
└────────────┬────────────────────────┘
             │
    (User clicks Approve/Reject/Paid)
             │
             ▼
┌─────────────────────────────────────┐
│   POST /api/.../approve (or reject) │
│   POST /api/.../paid                │
│   (Perform action)                  │
└────────────┬────────────────────────┘
             │
      (Refresh detail)
             │
             ▼
│  Detail screen updates with new status
```

---

## 🎯 Supervisor-Specific Features

**What Supervisors See:**

1. ✅ Timesheets from their assigned foremen only (filtered by supervisor site assignments)
2. ✅ Foreman name, fortnight range, sites, total days & wages
3. ✅ Full 14-day attendance grid when viewing detail
4. ✅ Status badges (SUBMITTED, APPROVED, REJECTED, PAID)
5. ✅ Action buttons to approve/reject/mark paid

**What Supervisors Cannot Do:**

- ❌ See timesheets from other supervisors' foremen
- ❌ Edit timesheet data (only approve/reject/mark paid)
- ❌ View foreman's personal info beyond name

---

## 🔐 Authentication

**Header Format:**

```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
Accept: application/json
```

**Token Payload (from login):**

```json
{
  "sub": "supervisor-id",
  "email": "supervisor@example.com",
  "role": "SUPERVISOR",
  "iat": 1234567890,
  "exp": 1234654290
}
```

---

## 📱 UI/UX Recommendations

### List Screen

- **Compact card view** or **table** (similar to mobile)
- **Swipe to filter** (optional, easier on mobile)
- **Search bar** at top
- **Period selector** as dropdown
- **Status pills** with colors:
  - 🔵 SUBMITTED (blue)
  - 🟢 APPROVED (green)
  - 🔴 REJECTED (red)
  - 🟣 PAID (purple)

### Detail Screen

- **Horizontal scroll** for 14-day grid
- **Sticky header** with foreman/supervisor/sites info
- **Action buttons** fixed at bottom or in header
- **Dialog for reject reason** with suggested reasons:
  - "Missing documentation"
  - "Incorrect hours"
  - "Incomplete information"
  - "Cannot verify details"
  - "Duplicate entry"

---

## 🚀 Implementation Priority

1. **Phase 1 (MVP):**
   - Login screen (already done)
   - List screen (GET /api/app/supervisor/timesheets)
   - Detail screen (GET /api/app/supervisor/timesheets/{id})
   - Approve action (POST .../approve)

2. **Phase 2:**
   - Reject action with dialog
   - Mark paid action
   - Search/filter functionality

3. **Phase 3 (Nice to have):**
   - Dashboard/stats screen
   - Period selector
   - Offline sync
   - Push notifications for new timesheets

---

## 💡 Key Notes

- **All requests require Bearer token** from login
- **Supervisor can only see foremen they're assigned to** (via site assignments)
- **ID format:** `YYYY-MM-DD_YYYY-MM-DD__foreman-id` (not user ID)
- **Default period:** Current fortnight (Sat-Fri)
- **Status flow:** SUBMITTED → (Approve→APPROVED or Reject→REJECTED) → (Mark Paid→PAID)
