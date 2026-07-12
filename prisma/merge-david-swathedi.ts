// prisma/merge-david-swathedi.ts
import { prisma } from "@/lib/prisma";

const keepEmail = "davids@gmail.com";
const removeEmail = "david.swathedi@foreman.local";

const finalName = "David Swathedi";
const finalFirstName = "David";
const finalLastName = "Swathedi";
const finalCard = "EMP-2FB4CF8D79B6EA1E";

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

function temporaryCard(employeeId: string) {
  return `MERGE-TEMP-${employeeId}`;
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
        throw new Error(`Main account not found: ${keepEmail}`);
      }

      if (!removeUser) {
        throw new Error(`Duplicate account not found: ${removeEmail}`);
      }

      await tx.$executeRaw`
        UPDATE "User"
        SET
          name = ${finalName},
          role = 'FOREMAN'
        WHERE id = ${keepUser.id}
      `;

      const keepEmployees = await tx.$queryRaw<IdRow[]>`
        SELECT id
        FROM "Employee"
        WHERE "userId" = ${keepUser.id}
        ORDER BY "createdAt" ASC
        LIMIT 1
      `;

      let keepEmployeeId = keepEmployees[0]?.id;

      if (!keepEmployeeId) {
        const cardEmployee = await tx.$queryRaw<IdRow[]>`
          SELECT id
          FROM "Employee"
          WHERE upper(replace("qrCodeValue", 'EMP-', '')) =
                upper(replace(${finalCard}, 'EMP-', ''))
          ORDER BY "createdAt" ASC
          LIMIT 1
        `;

        keepEmployeeId = cardEmployee[0]?.id;
      }

      if (!keepEmployeeId) {
        const duplicateEmployee = await tx.$queryRaw<IdRow[]>`
          SELECT id
          FROM "Employee"
          WHERE "userId" = ${removeUser.id}
          ORDER BY "createdAt" ASC
          LIMIT 1
        `;

        keepEmployeeId = duplicateEmployee[0]?.id;
      }

      if (!keepEmployeeId) {
        throw new Error(
          "No Employee record was found for either David account.",
        );
      }

      const duplicateEmployees = await tx.$queryRaw<IdRow[]>`
        SELECT id
        FROM "Employee"
        WHERE id <> ${keepEmployeeId}
          AND (
            "userId" IN (${keepUser.id}, ${removeUser.id})
            OR upper(replace("qrCodeValue", 'EMP-', '')) =
               upper(replace(${finalCard}, 'EMP-', ''))
            OR (
              lower("firstName") = lower(${finalFirstName})
              AND lower("lastName") = lower(${finalLastName})
            )
          )
      `;

      /*
       * Move duplicate cards to temporary unique values.
       * qrCodeValue cannot be NULL in this database.
       */
      for (const duplicate of duplicateEmployees) {
        await tx.$executeRaw`
          UPDATE "Employee"
          SET "qrCodeValue" = ${temporaryCard(duplicate.id)}
          WHERE id = ${duplicate.id}
        `;
      }

      /*
       * Also free the final card if another accidental record owns it.
       */
      const accidentalOwners = await tx.$queryRaw<IdRow[]>`
        SELECT id
        FROM "Employee"
        WHERE id <> ${keepEmployeeId}
          AND upper(replace("qrCodeValue", 'EMP-', '')) =
              upper(replace(${finalCard}, 'EMP-', ''))
      `;

      for (const owner of accidentalOwners) {
        await tx.$executeRaw`
          UPDATE "Employee"
          SET "qrCodeValue" = ${temporaryCard(owner.id)}
          WHERE id = ${owner.id}
        `;
      }

      /*
       * Make the retained Employee the correct David record.
       */
      await tx.$executeRaw`
        UPDATE "Employee"
        SET
          "firstName" = ${finalFirstName},
          "lastName" = ${finalLastName},
          "userId" = ${keepUser.id},
          "qrCodeValue" = ${finalCard},
          "isActive" = true
        WHERE id = ${keepEmployeeId}
      `;

      /*
       * Merge duplicate Employee attendance records.
       */
      for (const duplicate of duplicateEmployees) {
        if (hasAttendanceScan) {
          await tx.$executeRaw`
            DELETE FROM "AttendanceScan" duplicate_scan
            USING "AttendanceScan" retained_scan
            WHERE duplicate_scan."employeeId" = ${duplicate.id}
              AND retained_scan."employeeId" = ${keepEmployeeId}
              AND retained_scan."siteDayId" =
                  duplicate_scan."siteDayId"
          `;

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

      if (!keepForemanId && removeForemanId) {
        await tx.$executeRaw`
          UPDATE "Foreman"
          SET "userId" = ${keepUser.id}
          WHERE id = ${removeForemanId}
        `;

        keepForemanId = removeForemanId;
      }

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
                WHERE retained_day."foremanId" = ${keepForemanId}
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
            "Duplicate Foreman retained because historical SiteDays still reference it.",
          );
        }
      }

      const remainingEmployees = await tx.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM "Employee"
          WHERE "userId" = ${removeUser.id}
        `;

      const remainingForemen = await tx.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM "Foreman"
          WHERE "userId" = ${removeUser.id}
        `;

      if (
        remainingEmployees[0]?.count === BigInt(0) &&
        remainingForemen[0]?.count === BigInt(0)
      ) {
        await tx.$executeRaw`
          DELETE FROM "User"
          WHERE id = ${removeUser.id}
        `;
      } else {
        console.warn(
          `Duplicate user ${removeEmail} was retained because linked records still exist.`,
        );
      }
    },
    {
      maxWait: 30_000,
      timeout: 60_000,
    },
  );

  console.log("David Swathedi merged successfully.");
  console.log(`Account kept: ${keepEmail}`);
  console.log(`Role: FOREMAN`);
  console.log(`Correct QR: ${finalCard}`);
}

main()
  .catch((error) => {
    console.error("David merge failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
