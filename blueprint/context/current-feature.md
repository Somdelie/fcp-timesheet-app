# Feature: Night shift attendance - shift-type schema foundation

**From build-plan:** ad hoc (this project's build-plan.md/project-overview.md were
never filled in; spec'd directly per user request, see Notes)
**Status:** not started
**Split:** 1 of 3 - "Admin: manual double/night shift attendance entry"
  1. **This spec** - shift-type schema foundation + fix the two call sites that
     break when a second scan per employee/day becomes legal
  2. Next - fix payroll/timesheet aggregation surfaces that currently assume one
     `AttendanceScan` row per employee per `workDate`, so night-shift pay isn't
     silently dropped
  3. Next - new admin API + UI to actually create the night-shift scans

## Goal

Foremen sometimes work a crew a night shift on top of the normal day shift, but
`AttendanceScan` only allows one scan per employee per day
(`@@unique([employeeId, workDate])`, `@@unique([siteDayId, employeeId])` -
[schema.prisma:715-716](../../prisma/schema.prisma#L715-L716)), so there is
currently no way to record it. This sub-feature lays the schema groundwork -
a `shiftType` on `AttendanceScan` (`DAY` default, `NIGHT`) - and fixes the two
places in the app that hard-code the old single-scan-per-day assumption via the
Prisma compound unique key, so the constraint can safely widen without breaking
anything that already works. It delivers no new admin-facing capability by
itself; sub-features 2 and 3 build on top of it.

## In scope

- Add `enum ShiftType { DAY NIGHT }` and `shiftType ShiftType @default(DAY)` to
  `AttendanceScan`.
- Widen `@@unique([employeeId, workDate])` -> `@@unique([employeeId, workDate, shiftType])`
  and `@@unique([siteDayId, employeeId])` -> `@@unique([siteDayId, employeeId, shiftType])`.
  Add `@@index([shiftType])`.
- Additive migration via `prisma migrate dev` only. No `db push`, no data reset,
  no backfill needed - existing rows get `shiftType = DAY` from the column
  default.
- Update the two real call sites that reference the old two-field compound key
  or otherwise assume exactly one scan per employee/day:
  - `app/api/admin/trash/route.ts` (restore-from-trash) - compound key becomes
    `employeeId_workDate_shiftType`; trashed scans predate shifts, so restore
    always targets `shiftType: "DAY"`.
  - `app/api/app/supervisor/transfer-employee/route.ts` - the delete/recreate
    step that currently relies on the old unique constraint must scope to
    `shiftType: "DAY"` explicitly.

## Out of scope

- Any payroll/timesheet/wage view that sums or displays attendance per day
  (foreman + supervisor timesheets, wage-totals, employee-payroll-summary,
  dashboard top-site-wages, daily-exceptions) - deferred to sub-feature 2.
- The admin UI/API for actually creating a night-shift scan - sub-feature 3.
- Any change to how `transfer-employee` handles an employee who has *both* a
  DAY and a NIGHT scan on the transfer date - it will keep transferring only the
  DAY scan and leave NIGHT behind. Revisit only if this becomes a real workflow.
- Historical/archive scripts under `scripts/archive/` and one-off `_tmp-check-*.ts`
  files that use the old compound key - excluded from the tsconfig build
  (`scripts/`) or don't use the compound key form (`_tmp-check-*.ts`, confirmed
  by grep), so they don't block the build. Not touched.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [ ] **Step 1 - Schema migration** - add `ShiftType` enum and `shiftType`
  field (default `DAY`) to `AttendanceScan`; widen both unique constraints to
  include it; add the `shiftType` index. Run
  `prisma migrate dev --name add_attendance_shift_type`.
  *Done when:* migration file exists and applies cleanly against the dev DB,
  `prisma migrate status` reports up to date, no existing rows are touched
  (row count and all existing `id`s unchanged before/after), and
  `npx prisma generate` + `npm run build` both pass.

- [ ] **Step 2 - Fix trash restore** - update
  `app/api/admin/trash/route.ts` so the restore-from-trash lookup uses
  `employeeId_workDate_shiftType: { employeeId, workDate, shiftType: "DAY" }`
  instead of the old two-field key.
  *Done when:* `npm run build` passes (this file no longer references a
  compound key Prisma has renamed), and restoring a trashed scan for an
  employee/date with no existing DAY scan still succeeds exactly as before.

- [ ] **Step 3 - Fix transfer-employee** - update
  `app/api/app/supervisor/transfer-employee/route.ts` so the scan it looks up,
  deletes, and recreates on the destination site is explicitly the `DAY` scan
  for that employee/date, not just "the" scan.
  *Done when:* `npm run build` passes, and manually calling the transfer route
  (or its existing manual test path) for an employee with only a DAY scan
  behaves identically to today.

## Files / areas

- `prisma/schema.prisma` - `AttendanceScan` model, new `ShiftType` enum.
- `prisma/migrations/` - new migration folder.
- `app/api/admin/trash/route.ts`
- `app/api/app/supervisor/transfer-employee/route.ts`

## Data / contracts

- New enum `ShiftType { DAY NIGHT }`, default `DAY` - load-bearing for
  sub-features 2 and 3, which will filter/aggregate on it and create `NIGHT`
  rows respectively.
- Compound unique key renamed by Prisma from `employeeId_workDate` to
  `employeeId_workDate_shiftType`, and `siteDayId_employeeId` to
  `siteDayId_employeeId_shiftType` - any future code doing a direct compound
  lookup must use the new names.

## Testing

No test runner is configured for this project (no `test` command in
`AGENTS.md`), so the gate is build + manual verification, not unit tests:

- `npm run build` after each step (typecheck + build; `next.config.ts` has no
  `ignoreBuildErrors`, so this genuinely fails on the compound-key rename).
- `prisma migrate status` after Step 1.
- Manual/API check of trash restore (Step 2) and employee transfer (Step 3)
  against the dev database.

## Notes for the AI

- This project's `blueprint/project-plan.md` and `blueprint/build-plan.md` were
  never filled in even though the app itself is mature and already shipped.
  Per user decision, this spec was written directly without backfilling those
  docs or regenerating `project-overview.md` - don't block on their absence.
- Never use `prisma db push` or any command that resets/reseeds data - additive
  `prisma migrate dev` only, confirmed explicitly with the user.
- `dayRateAtScan` snapshot behavior on `AttendanceScan` is unaffected by this
  step - sub-feature 3 will copy it from the existing DAY row when creating a
  NIGHT row rather than recomputing it.
- After Step 3 is approved, stop and hand back to the user rather than
  continuing into sub-feature 2 - each sub-feature gets its own review/spec
  cycle per the split above.
