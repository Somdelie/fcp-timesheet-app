/**
 * One-time script to delete test foreman accounts and all their related data.
 * Run with: npx tsx prisma/delete-test-users.ts
 *
 * Handles the FK dependency order that Prisma cascades don't cover:
 *   SiteDay (no onDelete on Foreman FK) → must delete before User
 *   Timesheet (no onDelete on Foreman FK) → must delete before User
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const TEST_NAMES = ["Test", "Testing", "John Ndoe"];

async function main() {
  const users = await prisma.user.findMany({
    where: { name: { in: TEST_NAMES } },
    include: { foreman: true, employee: true },
  });

  if (users.length === 0) {
    console.log("No test users found matching:", TEST_NAMES.join(", "));
    return;
  }

  console.log(`Found ${users.length} test user(s):`);
  users.forEach((u) => console.log(`  - ${u.name} (${u.id})`));
  console.log();

  for (const user of users) {
    console.log(`Deleting: ${user.name} (${user.id})`);
    const foremanId = user.foreman?.id;

    // Everything inside a single transaction
    await prisma.$transaction(async (tx) => {
      if (foremanId) {
        // SiteDay has no onDelete on foremanId → must delete manually.
        // Deleting SiteDay cascades:
        //   AttendanceScan (onDelete: Cascade)
        //   SiteDayPhotoRequest (onDelete: Cascade)
        //   SiteDayPhoto (onDelete: Cascade) → PhotoVerification, PhotoDetection
        const { count: sdCount } = await tx.siteDay.deleteMany({
          where: { foremanId },
        });
        console.log(`  ✓ Deleted ${sdCount} SiteDay(s) + all cascaded scan/photo records`);

        // Timesheet has no onDelete on foremanId → must delete manually.
        // Deleting Timesheet cascades:
        //   TimesheetDayAcceptance (onDelete: Cascade)
        //   Deduction.timesheetId → SetNull (nullable FK, safe)
        const { count: tsCount } = await tx.timesheet.deleteMany({
          where: { foremanId },
        });
        console.log(`  ✓ Deleted ${tsCount} Timesheet(s) + day acceptances`);
      }

      // Safety: remove any Deduction or OvertimeEntry this user created as admin.
      // These have onDelete: Restrict on createdByUserId, so they must go before the User.
      await tx.deduction.deleteMany({ where: { createdByUserId: user.id } });
      await tx.overtimeEntry.deleteMany({ where: { createdByUserId: user.id } });

      // Delete the User. This cascades:
      //   Foreman (Cascade) → ForemanAssistant, ForemanEmployee, SupervisorForeman,
      //     ForemanSiteAssignment, SiteForemanDayRateOverride, Deduction (foremanId),
      //     ProductOrder (→ ProductOrderItem), OvertimeEntry, ForemanPpeOrder
      //   Supervisor (Cascade)
      //   Account, Session, PushToken, Notification, SchedulerTask (Cascade)
      //   UserNote → NoteComment, NoteMember, NoteInvite (Cascade)
      //   Employee.userId → SetNull (nullable FK)
      //   AuditEvent.actorUserId → SetNull (nullable FK)
      await tx.user.delete({ where: { id: user.id } });
      console.log(`  ✓ Deleted User (and all cascaded foreman records)`);
    });

    // Employee.userId was SetNull by the User delete above.
    // Clean up the now-orphaned Employee record and any scans it had.
    if (user.employee) {
      await prisma.attendanceScan
        .deleteMany({ where: { employeeId: user.employee.id } })
        .catch(() => {});
      await prisma.employee
        .delete({ where: { id: user.employee.id } })
        .catch(() => {});
      console.log(`  ✓ Deleted linked Employee record`);
    }

    console.log(`  Done: ${user.name}\n`);
  }

  console.log("All test users deleted successfully.");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
