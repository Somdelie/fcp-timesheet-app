// prisma/merge-gift-malatji.ts
import { prisma } from "@/lib/prisma";

const keepEmail = "giftmalatji@gmail.com";
const removeEmail = "gift.malatji@foreman.local";

const finalName = "Gift Malatji";
const finalFirstName = "Gift";
const finalLastName = "Malatji";
const finalCard = "78C3E26B849F7DBD";

const wrongCards = ["EMP-DEE721D95C91FF87", "DEE721D95C91FF87"];

type IdRow = {
  id: string;
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
};

async function tableExists(tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS "exists"
  `;

  return rows[0]?.exists === true;
}

async function main() {
  const hasAttendanceScan = await tableExists("AttendanceScan");
  const hasAttendanceCardScan = await tableExists("AttendanceCardScan");
  const hasForemanSiteAssignment = await tableExists("ForemanSiteAssignment");
  const hasSupervisorForeman = await tableExists("SupervisorForeman");
  const hasSiteDay = await tableExists("SiteDay");

  await prisma.$transaction(
    async (tx) => {
      const users = await tx.$queryRaw<UserRow[]>`
        SELECT id, email, name
        FROM "User"
        WHERE lower(email) IN (
          lower(${keepEmail}),
          lower(${removeEmail})
        )
      `;

      const keepUser = users.find(
        (user) => user.email.toLowerCase() === keepEmail.toLowerCase(),
      );

      const removeUser = users.find(
        (user) => user.email.toLowerCase() === removeEmail.toLowerCase(),
      );

      if (!keepUser) {
        throw new Error(`Correct user not found: ${keepEmail}`);
      }

      if (!removeUser) {
        throw new Error(`Temporary user not found: ${removeEmail}`);
      }

      await tx.$executeRaw`
        UPDATE "User"
        SET
          name = ${finalName},
          role = 'FOREMAN'
        WHERE id = ${keepUser.id}
      `;

      /*
       * Find the correct employee using the working card first.
       */
      const correctEmployees = await tx.$queryRaw<IdRow[]>`
        SELECT id
        FROM "Employee"
        WHERE upper(replace("qrCodeValue", 'EMP-', '')) =
              upper(replace(${finalCard}, 'EMP-', ''))
        ORDER BY "createdAt" ASC
        LIMIT 1
      `;

      let keepEmployeeId = correctEmployees[0]?.id;

      /*
       * If the correct card record does not exist, use the employee connected
       * to the Gmail account.
       */
      if (!keepEmployeeId) {
        const linkedEmployees = await tx.$queryRaw<IdRow[]>`
          SELECT id
          FROM "Employee"
          WHERE "userId" = ${keepUser.id}
          ORDER BY "createdAt" ASC
          LIMIT 1
        `;

        keepEmployeeId = linkedEmployees[0]?.id;
      }

      if (!keepEmployeeId) {
        throw new Error(
          `No correct Employee record found for card ${finalCard}.`,
        );
      }

      /*
       * Find duplicate employee records using the wrong card, temporary user,
       * or the duplicate full name.
       */
      const duplicateEmployees = await tx.$queryRaw<IdRow[]>`
        SELECT id
        FROM "Employee"
        WHERE id <> ${keepEmployeeId}
          AND (
            "userId" = ${removeUser.id}
            OR upper("qrCodeValue") IN (
              upper(${wrongCards[0]}),
              upper(${wrongCards[1]})
            )
            OR (
              lower("firstName") = lower('Tiiesetso Gift')
              AND lower("lastName") = lower('Malatji')
            )
          )
      `;

      /*
       * Make the retained employee canonical.
       */
      await tx.$executeRaw`
        UPDATE "Employee"
        SET
          "firstName" = ${finalFirstName},
          "lastName" = ${finalLastName},
          "qrCodeValue" = ${finalCard},
          "userId" = ${keepUser.id},
          "isActive" = true
        WHERE id = ${keepEmployeeId}
      `;

      for (const duplicate of duplicateEmployees) {
        if (hasAttendanceScan) {
          /*
           * Delete duplicate same-day/SiteDay scans when both employee
           * records were captured for the same day.
           */
          await tx.$executeRaw`
            DELETE FROM "AttendanceScan" duplicate_scan
            USING "AttendanceScan" retained_scan
            WHERE duplicate_scan."employeeId" = ${duplicate.id}
              AND retained_scan."employeeId" = ${keepEmployeeId}
              AND duplicate_scan."siteDayId" =
                  retained_scan."siteDayId"
          `;

          /*
           * Preserve unique historical attendance by moving it to the
           * correct employee.
           */
          await tx.$executeRaw`
            UPDATE "AttendanceScan"
            SET
              "employeeId" = ${keepEmployeeId},
              "qrPayload" = ${finalCard}
            WHERE "employeeId" = ${duplicate.id}
          `;
        }

        if (hasAttendanceCardScan) {
          await tx.$executeRaw`
            UPDATE "AttendanceCardScan"
            SET
              "employeeId" = ${keepEmployeeId},
              "cardNumber" = ${finalCard},
              status = 'MATCHED'
            WHERE "employeeId" = ${duplicate.id}
               OR upper("cardNumber") IN (
                    upper(${wrongCards[0]}),
                    upper(${wrongCards[1]})
                  )
          `;
        }

        await tx.$executeRaw`
          DELETE FROM "Employee"
          WHERE id = ${duplicate.id}
        `;
      }

      /*
       * Merge Foreman profiles.
       */
      const keepForemen = await tx.$queryRaw<IdRow[]>`
        SELECT id
        FROM "Foreman"
        WHERE "userId" = ${keepUser.id}
        LIMIT 1
      `;

      const removeForemen = await tx.$queryRaw<IdRow[]>`
        SELECT id
        FROM "Foreman"
        WHERE "userId" = ${removeUser.id}
        LIMIT 1
      `;

      let keepForemanId = keepForemen[0]?.id;
      const removeForemanId = removeForemen[0]?.id;

      /*
       * If only the temporary account has the Foreman profile, move that
       * profile to the Gmail account.
       */
      if (!keepForemanId && removeForemanId) {
        await tx.$executeRaw`
          UPDATE "Foreman"
          SET "userId" = ${keepUser.id}
          WHERE id = ${removeForemanId}
        `;

        keepForemanId = removeForemanId;
      }

      /*
       * If neither account has a Foreman profile, create one.
       */
      if (!keepForemanId) {
        const createdForeman = await tx.$queryRaw<IdRow[]>`
          INSERT INTO "Foreman" (
            id,
            "userId",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            gen_random_uuid()::text,
            ${keepUser.id},
            NOW(),
            NOW()
          )
          RETURNING id
        `;

        keepForemanId = createdForeman[0]?.id;
      }

      if (
        keepForemanId &&
        removeForemanId &&
        keepForemanId !== removeForemanId
      ) {
        if (hasForemanSiteAssignment) {
          await tx.$executeRaw`
            DELETE FROM "ForemanSiteAssignment" old_assignment
            USING "ForemanSiteAssignment" retained_assignment
            WHERE old_assignment."foremanId" = ${removeForemanId}
              AND retained_assignment."foremanId" = ${keepForemanId}
              AND retained_assignment."siteId" =
                  old_assignment."siteId"
              AND retained_assignment."endsOn"
                  IS NOT DISTINCT FROM old_assignment."endsOn"
          `;

          await tx.$executeRaw`
            UPDATE "ForemanSiteAssignment"
            SET "foremanId" = ${keepForemanId}
            WHERE "foremanId" = ${removeForemanId}
          `;
        }

        if (hasSupervisorForeman) {
          await tx.$executeRaw`
            DELETE FROM "SupervisorForeman" old_link
            USING "SupervisorForeman" retained_link
            WHERE old_link."foremanId" = ${removeForemanId}
              AND retained_link."foremanId" = ${keepForemanId}
              AND retained_link."supervisorId" =
                  old_link."supervisorId"
          `;

          await tx.$executeRaw`
            UPDATE "SupervisorForeman"
            SET "foremanId" = ${keepForemanId}
            WHERE "foremanId" = ${removeForemanId}
          `;
        }

        if (hasSiteDay) {
          await tx.$executeRaw`
            UPDATE "SiteDay" old_day
            SET "foremanId" = ${keepForemanId}
            WHERE old_day."foremanId" = ${removeForemanId}
              AND NOT EXISTS (
                SELECT 1
                FROM "SiteDay" retained_day
                WHERE retained_day."foremanId" =
                      ${keepForemanId}
                  AND retained_day."workDate" =
                      old_day."workDate"
              )
          `;
        }

        const remainingSiteDays = hasSiteDay
          ? await tx.$queryRaw<Array<{ count: bigint }>>`
              SELECT COUNT(*)::bigint AS count
              FROM "SiteDay"
              WHERE "foremanId" = ${removeForemanId}
            `
          : [{ count: BigInt(0) }];

        if (remainingSiteDays[0]?.count === BigInt(0)) {
          await tx.$executeRaw`
            DELETE FROM "Foreman"
            WHERE id = ${removeForemanId}
          `;
        } else {
          console.warn(
            "Duplicate Foreman retained because conflicting historical SiteDays still reference it.",
          );
        }
      }

      /*
       * Delete temporary account when nothing still references it.
       */
      const remainingForemanReferences = await tx.$queryRaw<
        Array<{ count: bigint }>
      >`
          SELECT COUNT(*)::bigint AS count
          FROM "Foreman"
          WHERE "userId" = ${removeUser.id}
        `;

      const remainingEmployeeReferences = await tx.$queryRaw<
        Array<{ count: bigint }>
      >`
          SELECT COUNT(*)::bigint AS count
          FROM "Employee"
          WHERE "userId" = ${removeUser.id}
        `;

      if (
        remainingForemanReferences[0]?.count === BigInt(0) &&
        remainingEmployeeReferences[0]?.count === BigInt(0)
      ) {
        await tx.$executeRaw`
          DELETE FROM "User"
          WHERE id = ${removeUser.id}
        `;
      } else {
        console.warn(
          `Temporary user ${removeEmail} still has linked historical records and was not deleted.`,
        );
      }
    },
    {
      maxWait: 30_000,
      timeout: 60_000,
    },
  );

  console.log("Gift Malatji merged successfully.");
  console.log(`Account kept: ${keepEmail}`);
  console.log(`Name: ${finalName}`);
  console.log(`Correct card: ${finalCard}`);
  console.log(`Temporary account removed: ${removeEmail}`);
  console.log(`Wrong card removed: ${wrongCards[0]}`);
}

main()
  .catch((error) => {
    console.error("Merge failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
