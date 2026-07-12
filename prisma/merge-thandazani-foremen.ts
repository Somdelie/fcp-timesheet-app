// prisma/merge-thandazani-foremen.ts
//
// Keeps:
//   thandazani@gmail.com
//
// Merges/removes Foreman record belonging to:
//   thandaza356@gmail.com
//
// Also:
// - moves SiteDays to the correct Foreman;
// - merges conflicting SiteDays safely;
// - preserves AttendanceScans;
// - removes duplicate scans for the same employee/day;
// - renames the correct User to "Thandazani Ndlovu";
// - updates the employee QR to EMP-457B8B42819526E8;
// - does not delete the old User account automatically.
//
// Preview:
//   pnpm tsx prisma/merge-thandazani-foremen.ts
//
// Apply:
//   pnpm tsx prisma/merge-thandazani-foremen.ts --apply

import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

const KEEP_EMAIL = "thandazani@gmail.com";
const DUPLICATE_EMAIL = "thandaza356@gmail.com";

const CORRECT_NAME = "Thandazani Ndlovu";
const CORRECT_QR_CODE = "EMP-457B8B42819526E8";
const CORRECT_DAY_RATE = 280;

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function sameDateTime(left: Date, right: Date) {
  return left.getTime() === right.getTime();
}

function toDateText(value: Date) {
  return value.toISOString().slice(0, 10);
}

function mergeEndsOn(left: Date | null, right: Date | null) {
  if (left === null || right === null) {
    return null;
  }

  return left > right ? left : right;
}

const TIMESHEET_STATUS_RANK = {
  SUBMITTED: 1,
  REJECTED: 2,
  ACCEPTED: 3,
  APPROVED: 4,
  PAID: 5,
} as const;

const DAY_ACCEPTANCE_STATUS_RANK = {
  PENDING: 1,
  REJECTED: 2,
  ACCEPTED: 3,
} as const;

function pickPreferredByStatus<
  T extends { status: keyof typeof TIMESHEET_STATUS_RANK; updatedAt: Date },
>(currentRecord: T, incomingRecord: T) {
  const currentRank = TIMESHEET_STATUS_RANK[currentRecord.status] ?? 0;
  const incomingRank = TIMESHEET_STATUS_RANK[incomingRecord.status] ?? 0;

  if (incomingRank !== currentRank) {
    return incomingRank > currentRank ? incomingRecord : currentRecord;
  }

  return incomingRecord.updatedAt > currentRecord.updatedAt
    ? incomingRecord
    : currentRecord;
}

function pickPreferredDayAcceptance<
  T extends {
    status: keyof typeof DAY_ACCEPTANCE_STATUS_RANK;
    updatedAt: Date;
  },
>(currentRecord: T, incomingRecord: T) {
  const currentRank = DAY_ACCEPTANCE_STATUS_RANK[currentRecord.status] ?? 0;
  const incomingRank = DAY_ACCEPTANCE_STATUS_RANK[incomingRecord.status] ?? 0;

  if (incomingRank !== currentRank) {
    return incomingRank > currentRank ? incomingRecord : currentRecord;
  }

  return incomingRecord.updatedAt > currentRecord.updatedAt
    ? incomingRecord
    : currentRecord;
}

function describeTimesheet(args: {
  period: { label: string | null; startDate: Date; endDate: Date };
  site: { code: string | null; name: string } | null;
}) {
  const periodText =
    args.period.label?.trim() ||
    `${toDateText(args.period.startDate)} → ${toDateText(args.period.endDate)}`;

  const siteText = args.site
    ? `${args.site.code ?? "NO-CODE"} ${args.site.name}`
    : "NO SITE";

  return `${periodText} | ${siteText}`;
}

async function main() {
  let movedSiteDays = 0;
  let mergedSiteDays = 0;
  let movedScans = 0;
  let deletedDuplicateScans = 0;
  let movedTimesheets = 0;
  let mergedTimesheets = 0;
  let movedDayAcceptances = 0;
  let mergedDayAcceptances = 0;
  let movedDeductions = 0;
  let movedSupervisorLinks = 0;
  let mergedSupervisorLinks = 0;
  let movedSiteAssignments = 0;
  let mergedSiteAssignments = 0;

  const users = await prisma.user.findMany({
    where: {
      email: {
        in: [KEEP_EMAIL, DUPLICATE_EMAIL],
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      foreman: {
        select: {
          id: true,
        },
      },
    },
  });

  const keepUser = users.find(
    (user) => normalize(user.email) === normalize(KEEP_EMAIL),
  );

  const duplicateUser = users.find(
    (user) => normalize(user.email) === normalize(DUPLICATE_EMAIL),
  );

  if (!keepUser) {
    throw new Error(`Correct user was not found for email: ${KEEP_EMAIL}`);
  }

  if (!keepUser.foreman) {
    throw new Error(
      `The correct user ${KEEP_EMAIL} does not have a Foreman record.`,
    );
  }

  if (!duplicateUser) {
    throw new Error(
      `Duplicate user was not found for email: ${DUPLICATE_EMAIL}`,
    );
  }

  if (!duplicateUser.foreman) {
    throw new Error(
      `The duplicate user ${DUPLICATE_EMAIL} does not have a Foreman record.`,
    );
  }

  const keepForemanId = keepUser.foreman.id;
  const duplicateForemanId = duplicateUser.foreman.id;

  if (keepForemanId === duplicateForemanId) {
    throw new Error(
      "Both users point to the same Foreman record. Nothing to merge.",
    );
  }

  console.log("");
  console.log("Thandazani Foreman merge");
  console.log("=".repeat(76));
  console.log(`KEEP: ${keepUser.name} <${keepUser.email}> — ${keepForemanId}`);
  console.log(
    `MERGE: ${duplicateUser.name} <${duplicateUser.email}> — ` +
      duplicateForemanId,
  );
  console.log(`Correct name: ${CORRECT_NAME}`);
  console.log(`Correct QR: ${CORRECT_QR_CODE}`);
  console.log(`Mode: ${APPLY ? "APPLY" : "PREVIEW"}`);
  console.log("=".repeat(76));

  const duplicateSiteDays = await prisma.siteDay.findMany({
    where: {
      foremanId: duplicateForemanId,
    },
    select: {
      id: true,
      siteId: true,
      workDate: true,
      site: {
        select: {
          code: true,
          name: true,
        },
      },
    },
    orderBy: {
      workDate: "asc",
    },
  });

  for (const duplicateSiteDay of duplicateSiteDays) {
    const workDateText = duplicateSiteDay.workDate.toISOString().slice(0, 10);

    const existingKeepSiteDay = await prisma.siteDay.findFirst({
      where: {
        foremanId: keepForemanId,
        siteId: duplicateSiteDay.siteId,
        workDate: duplicateSiteDay.workDate,
      },
      select: {
        id: true,
      },
    });

    if (!existingKeepSiteDay) {
      console.log(
        `MOVE SITE DAY → ${workDateText} | ` +
          `${duplicateSiteDay.site.code} ${duplicateSiteDay.site.name}`,
      );

      if (APPLY) {
        await prisma.siteDay.update({
          where: {
            id: duplicateSiteDay.id,
          },
          data: {
            foremanId: keepForemanId,
          },
        });
      }

      movedSiteDays++;
      continue;
    }

    console.log(
      `MERGE SITE DAY → ${workDateText} | ` +
        `${duplicateSiteDay.site.code} ${duplicateSiteDay.site.name}`,
    );

    const duplicateScans = await prisma.attendanceScan.findMany({
      where: {
        siteDayId: duplicateSiteDay.id,
      },
      select: {
        id: true,
        employeeId: true,
      },
    });

    for (const scan of duplicateScans) {
      const existingScan = await prisma.attendanceScan.findFirst({
        where: {
          siteDayId: existingKeepSiteDay.id,
          employeeId: scan.employeeId,
        },
        select: {
          id: true,
        },
      });

      if (existingScan) {
        console.log(`  DELETE DUPLICATE SCAN → employee ${scan.employeeId}`);

        if (APPLY) {
          await prisma.attendanceScan.delete({
            where: {
              id: scan.id,
            },
          });
        }

        deletedDuplicateScans++;
      } else {
        console.log(`  MOVE SCAN → employee ${scan.employeeId}`);

        if (APPLY) {
          await prisma.attendanceScan.update({
            where: {
              id: scan.id,
            },
            data: {
              siteDayId: existingKeepSiteDay.id,
              siteId: duplicateSiteDay.siteId,
            },
          });
        }

        movedScans++;
      }
    }

    if (APPLY) {
      const remainingScans = await prisma.attendanceScan.count({
        where: {
          siteDayId: duplicateSiteDay.id,
        },
      });

      if (remainingScans > 0) {
        throw new Error(
          `Cannot delete duplicate SiteDay ${duplicateSiteDay.id}; ` +
            `${remainingScans} scans still remain.`,
        );
      }

      await prisma.siteDay.delete({
        where: {
          id: duplicateSiteDay.id,
        },
      });
    }

    mergedSiteDays++;
  }

  const duplicateTimesheets = await prisma.timesheet.findMany({
    where: {
      foremanId: duplicateForemanId,
    },
    select: {
      id: true,
      periodId: true,
      siteId: true,
      status: true,
      submittedAt: true,
      approvedAt: true,
      rejectedAt: true,
      paidAt: true,
      approvedBySupervisorId: true,
      rejectionReason: true,
      totalWorkerWages: true,
      totalWorkerDays: true,
      updatedAt: true,
      period: {
        select: {
          label: true,
          startDate: true,
          endDate: true,
        },
      },
      site: {
        select: {
          code: true,
          name: true,
        },
      },
      dayAcceptances: {
        select: {
          id: true,
          workDate: true,
          status: true,
          acceptedAt: true,
          rejectedAt: true,
          rejectionReason: true,
          acceptedBySupervisorId: true,
          updatedAt: true,
        },
        orderBy: {
          workDate: "asc",
        },
      },
    },
    orderBy: [
      {
        period: {
          startDate: "asc",
        },
      },
      {
        createdAt: "asc",
      },
    ],
  });

  for (const duplicateTimesheet of duplicateTimesheets) {
    const timesheetText = describeTimesheet({
      period: duplicateTimesheet.period,
      site: duplicateTimesheet.site,
    });

    const existingKeepTimesheet = await prisma.timesheet.findFirst({
      where: {
        foremanId: keepForemanId,
        periodId: duplicateTimesheet.periodId,
        siteId: duplicateTimesheet.siteId,
      },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        approvedAt: true,
        rejectedAt: true,
        paidAt: true,
        approvedBySupervisorId: true,
        rejectionReason: true,
        totalWorkerWages: true,
        totalWorkerDays: true,
        updatedAt: true,
        dayAcceptances: {
          select: {
            id: true,
            workDate: true,
            status: true,
            acceptedAt: true,
            rejectedAt: true,
            rejectionReason: true,
            acceptedBySupervisorId: true,
            updatedAt: true,
          },
          orderBy: {
            workDate: "asc",
          },
        },
      },
    });

    if (!existingKeepTimesheet) {
      console.log(`MOVE TIMESHEET → ${timesheetText}`);

      if (APPLY) {
        await prisma.timesheet.update({
          where: {
            id: duplicateTimesheet.id,
          },
          data: {
            foremanId: keepForemanId,
          },
        });
      }

      movedTimesheets++;
      continue;
    }

    console.log(`MERGE TIMESHEET → ${timesheetText}`);

    for (const duplicateDayAcceptance of duplicateTimesheet.dayAcceptances) {
      const existingDayAcceptance = existingKeepTimesheet.dayAcceptances.find(
        (candidate) =>
          sameDateTime(candidate.workDate, duplicateDayAcceptance.workDate),
      );

      if (!existingDayAcceptance) {
        console.log(
          `  MOVE DAY ACCEPTANCE → ${toDateText(duplicateDayAcceptance.workDate)}`,
        );

        if (APPLY) {
          await prisma.timesheetDayAcceptance.update({
            where: {
              id: duplicateDayAcceptance.id,
            },
            data: {
              timesheetId: existingKeepTimesheet.id,
            },
          });
        }

        movedDayAcceptances++;
        continue;
      }

      const preferredDayAcceptance = pickPreferredDayAcceptance(
        existingDayAcceptance,
        duplicateDayAcceptance,
      );

      console.log(
        `  MERGE DAY ACCEPTANCE → ${toDateText(duplicateDayAcceptance.workDate)}`,
      );

      if (APPLY) {
        if (preferredDayAcceptance.id === duplicateDayAcceptance.id) {
          await prisma.timesheetDayAcceptance.update({
            where: {
              id: existingDayAcceptance.id,
            },
            data: {
              status: duplicateDayAcceptance.status,
              acceptedAt: duplicateDayAcceptance.acceptedAt,
              rejectedAt: duplicateDayAcceptance.rejectedAt,
              rejectionReason: duplicateDayAcceptance.rejectionReason,
              acceptedBySupervisorId:
                duplicateDayAcceptance.acceptedBySupervisorId,
            },
          });
        }

        await prisma.timesheetDayAcceptance.delete({
          where: {
            id: duplicateDayAcceptance.id,
          },
        });
      }

      mergedDayAcceptances++;
    }

    if (APPLY) {
      const preferredTimesheet = pickPreferredByStatus(
        existingKeepTimesheet,
        duplicateTimesheet,
      );

      const movedLinkedDeductions = await prisma.deduction.updateMany({
        where: {
          timesheetId: duplicateTimesheet.id,
        },
        data: {
          timesheetId: existingKeepTimesheet.id,
          foremanId: keepForemanId,
        },
      });

      movedDeductions += movedLinkedDeductions.count;

      await prisma.timesheet.update({
        where: {
          id: existingKeepTimesheet.id,
        },
        data: {
          status: preferredTimesheet.status,
          submittedAt:
            existingKeepTimesheet.submittedAt ?? duplicateTimesheet.submittedAt,
          approvedAt: preferredTimesheet.approvedAt,
          rejectedAt: preferredTimesheet.rejectedAt,
          paidAt: preferredTimesheet.paidAt,
          approvedBySupervisorId: preferredTimesheet.approvedBySupervisorId,
          rejectionReason: preferredTimesheet.rejectionReason,
          totalWorkerWages:
            preferredTimesheet.totalWorkerWages ??
            existingKeepTimesheet.totalWorkerWages ??
            duplicateTimesheet.totalWorkerWages,
          totalWorkerDays:
            preferredTimesheet.totalWorkerDays ??
            existingKeepTimesheet.totalWorkerDays ??
            duplicateTimesheet.totalWorkerDays,
        },
      });

      await prisma.timesheet.delete({
        where: {
          id: duplicateTimesheet.id,
        },
      });
    }

    mergedTimesheets++;
  }

  const duplicateForemanDeductionCount = await prisma.deduction.count({
    where: {
      foremanId: duplicateForemanId,
    },
  });

  if (duplicateForemanDeductionCount > 0) {
    console.log(`MOVE DEDUCTIONS → ${duplicateForemanDeductionCount}`);

    if (APPLY) {
      const movedForemanDeductions = await prisma.deduction.updateMany({
        where: {
          foremanId: duplicateForemanId,
        },
        data: {
          foremanId: keepForemanId,
        },
      });

      movedDeductions += movedForemanDeductions.count;
    }
  }

  const duplicateSupervisorLinks = await prisma.supervisorForeman.findMany({
    where: {
      foremanId: duplicateForemanId,
    },
    select: {
      supervisorId: true,
      foremanId: true,
      startsOn: true,
      endsOn: true,
      supervisor: {
        select: {
          id: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: {
      startsOn: "asc",
    },
  });

  for (const duplicateSupervisorLink of duplicateSupervisorLinks) {
    const supervisorLabel =
      duplicateSupervisorLink.supervisor.user.name?.trim() ||
      duplicateSupervisorLink.supervisor.user.email ||
      duplicateSupervisorLink.supervisor.id;

    const existingKeepSupervisorLink =
      await prisma.supervisorForeman.findUnique({
        where: {
          supervisorId_foremanId_startsOn: {
            supervisorId: duplicateSupervisorLink.supervisorId,
            foremanId: keepForemanId,
            startsOn: duplicateSupervisorLink.startsOn,
          },
        },
        select: {
          supervisorId: true,
          foremanId: true,
          startsOn: true,
          endsOn: true,
        },
      });

    if (!existingKeepSupervisorLink) {
      console.log(
        `MOVE SUPERVISOR LINK → ${supervisorLabel} | ${toDateText(duplicateSupervisorLink.startsOn)}`,
      );

      if (APPLY) {
        await prisma.supervisorForeman.update({
          where: {
            supervisorId_foremanId_startsOn: {
              supervisorId: duplicateSupervisorLink.supervisorId,
              foremanId: duplicateSupervisorLink.foremanId,
              startsOn: duplicateSupervisorLink.startsOn,
            },
          },
          data: {
            foremanId: keepForemanId,
          },
        });
      }

      movedSupervisorLinks++;
      continue;
    }

    console.log(
      `MERGE SUPERVISOR LINK → ${supervisorLabel} | ${toDateText(duplicateSupervisorLink.startsOn)}`,
    );

    if (APPLY) {
      await prisma.supervisorForeman.update({
        where: {
          supervisorId_foremanId_startsOn: {
            supervisorId: existingKeepSupervisorLink.supervisorId,
            foremanId: existingKeepSupervisorLink.foremanId,
            startsOn: existingKeepSupervisorLink.startsOn,
          },
        },
        data: {
          endsOn: mergeEndsOn(
            existingKeepSupervisorLink.endsOn,
            duplicateSupervisorLink.endsOn,
          ),
        },
      });

      await prisma.supervisorForeman.delete({
        where: {
          supervisorId_foremanId_startsOn: {
            supervisorId: duplicateSupervisorLink.supervisorId,
            foremanId: duplicateSupervisorLink.foremanId,
            startsOn: duplicateSupervisorLink.startsOn,
          },
        },
      });
    }

    mergedSupervisorLinks++;
  }

  const duplicateSiteAssignments = await prisma.foremanSiteAssignment.findMany({
    where: {
      foremanId: duplicateForemanId,
    },
    select: {
      id: true,
      siteId: true,
      startsOn: true,
      endsOn: true,
      site: {
        select: {
          code: true,
          name: true,
        },
      },
    },
    orderBy: {
      startsOn: "asc",
    },
  });

  for (const duplicateSiteAssignment of duplicateSiteAssignments) {
    const siteLabel = `${duplicateSiteAssignment.site.code ?? "NO-CODE"} ${duplicateSiteAssignment.site.name}`;

    const existingKeepSiteAssignment =
      await prisma.foremanSiteAssignment.findFirst({
        where: {
          foremanId: keepForemanId,
          siteId: duplicateSiteAssignment.siteId,
          startsOn: duplicateSiteAssignment.startsOn,
        },
        select: {
          id: true,
          endsOn: true,
        },
      });

    if (!existingKeepSiteAssignment) {
      console.log(
        `MOVE SITE ASSIGNMENT → ${siteLabel} | ${toDateText(duplicateSiteAssignment.startsOn)}`,
      );

      if (APPLY) {
        await prisma.foremanSiteAssignment.update({
          where: {
            id: duplicateSiteAssignment.id,
          },
          data: {
            foremanId: keepForemanId,
          },
        });
      }

      movedSiteAssignments++;
      continue;
    }

    console.log(
      `MERGE SITE ASSIGNMENT → ${siteLabel} | ${toDateText(duplicateSiteAssignment.startsOn)}`,
    );

    if (APPLY) {
      await prisma.foremanSiteAssignment.update({
        where: {
          id: existingKeepSiteAssignment.id,
        },
        data: {
          endsOn: mergeEndsOn(
            existingKeepSiteAssignment.endsOn,
            duplicateSiteAssignment.endsOn,
          ),
        },
      });

      await prisma.foremanSiteAssignment.delete({
        where: {
          id: duplicateSiteAssignment.id,
        },
      });
    }

    mergedSiteAssignments++;
  }

  /*
   * Find the employee record for Thandazani.
   * We prefer the employee already holding the correct QR.
   */
  const employeeMatches = await prisma.employee.findMany({
    where: {
      OR: [
        {
          qrCodeValue: {
            equals: CORRECT_QR_CODE,
            mode: "insensitive",
          },
        },
        {
          AND: [
            {
              firstName: {
                equals: "Thandazani",
                mode: "insensitive",
              },
            },
            {
              lastName: {
                equals: "Ndlovu",
                mode: "insensitive",
              },
            },
          ],
        },
        {
          AND: [
            {
              firstName: {
                equals: "Thandazani",
                mode: "insensitive",
              },
            },
            {
              lastName: {
                equals: "Ndlovu 2",
                mode: "insensitive",
              },
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      defaultDayRate: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (employeeMatches.length === 0) {
    console.log("");
    console.log(`EMPLOYEE CREATE → ${CORRECT_NAME} (${CORRECT_QR_CODE})`);

    if (APPLY) {
      await prisma.employee.create({
        data: {
          firstName: "Thandazani",
          lastName: "Ndlovu",
          qrCodeValue: CORRECT_QR_CODE,
          defaultDayRate: CORRECT_DAY_RATE,
          isActive: true,
        },
      });
    }
  } else {
    const keepEmployee =
      employeeMatches.find(
        (employee) =>
          normalize(employee.qrCodeValue) === normalize(CORRECT_QR_CODE),
      ) ?? employeeMatches[0];

    const duplicateEmployees = employeeMatches.filter(
      (employee) => employee.id !== keepEmployee.id,
    );

    console.log("");
    console.log(
      `EMPLOYEE KEEP → ${keepEmployee.firstName} ` +
        `${keepEmployee.lastName} (${keepEmployee.id})`,
    );

    for (const duplicateEmployee of duplicateEmployees) {
      console.log(
        `EMPLOYEE MERGE → ${duplicateEmployee.firstName} ` +
          `${duplicateEmployee.lastName} (${duplicateEmployee.id})`,
      );

      const scans = await prisma.attendanceScan.findMany({
        where: {
          employeeId: duplicateEmployee.id,
        },
        select: {
          id: true,
          siteDayId: true,
        },
      });

      for (const scan of scans) {
        const existingScan = await prisma.attendanceScan.findFirst({
          where: {
            employeeId: keepEmployee.id,
            siteDayId: scan.siteDayId,
          },
          select: {
            id: true,
          },
        });

        if (existingScan) {
          console.log(`  DELETE DUPLICATE EMPLOYEE SCAN → ${scan.id}`);

          if (APPLY) {
            await prisma.attendanceScan.delete({
              where: {
                id: scan.id,
              },
            });
          }
        } else {
          console.log(`  MOVE EMPLOYEE SCAN → ${scan.id}`);

          if (APPLY) {
            await prisma.attendanceScan.update({
              where: {
                id: scan.id,
              },
              data: {
                employeeId: keepEmployee.id,
                qrPayload: CORRECT_QR_CODE,
              },
            });
          }
        }
      }

      if (APPLY) {
        await prisma.employee.delete({
          where: {
            id: duplicateEmployee.id,
          },
        });
      }
    }

    console.log(`EMPLOYEE UPDATE → ${CORRECT_NAME} (${CORRECT_QR_CODE})`);

    if (APPLY) {
      /*
       * Clear the QR from another employee first if the database
       * currently has it assigned to an incorrect duplicate.
       */
      await prisma.employee.updateMany({
        where: {
          qrCodeValue: {
            equals: CORRECT_QR_CODE,
            mode: "insensitive",
          },
          NOT: {
            id: keepEmployee.id,
          },
        },
        data: {
          qrCodeValue: undefined,
        },
      });

      await prisma.employee.update({
        where: {
          id: keepEmployee.id,
        },
        data: {
          firstName: "Thandazani",
          lastName: "Ndlovu",
          qrCodeValue: CORRECT_QR_CODE,
          defaultDayRate: CORRECT_DAY_RATE,
          isActive: true,
        },
      });
    }
  }

  console.log("");
  console.log(`USER RENAME → ${keepUser.name} → ${CORRECT_NAME}`);

  if (APPLY) {
    await prisma.user.update({
      where: {
        id: keepUser.id,
      },
      data: {
        name: CORRECT_NAME,
      },
    });
  }

  /*
   * Delete only the duplicate Foreman row.
   * We intentionally leave the duplicate User account untouched,
   * because it may have authentication/audit history.
   */
  console.log(`DELETE DUPLICATE FOREMAN → ${duplicateForemanId}`);

  if (APPLY) {
    const remainingSiteDays = await prisma.siteDay.count({
      where: {
        foremanId: duplicateForemanId,
      },
    });

    const remainingTimesheets = await prisma.timesheet.count({
      where: {
        foremanId: duplicateForemanId,
      },
    });

    const remainingDependencies = {
      foremanAssistants: await prisma.foremanAssistant.count({
        where: {
          foremanId: duplicateForemanId,
        },
      }),
      foremanEmployees: await prisma.foremanEmployee.count({
        where: {
          foremanId: duplicateForemanId,
        },
      }),
      supervisorLinks: await prisma.supervisorForeman.count({
        where: {
          foremanId: duplicateForemanId,
        },
      }),
      siteAssignments: await prisma.foremanSiteAssignment.count({
        where: {
          foremanId: duplicateForemanId,
        },
      }),
      deductions: await prisma.deduction.count({
        where: {
          foremanId: duplicateForemanId,
        },
      }),
      productOrders: await prisma.productOrder.count({
        where: {
          foremanId: duplicateForemanId,
        },
      }),
      siteProductOrders: await prisma.siteProductOrder.count({
        where: {
          foremanId: duplicateForemanId,
        },
      }),
      siteDayRateOverrides: await prisma.siteForemanDayRateOverride.count({
        where: {
          foremanId: duplicateForemanId,
        },
      }),
      overtimeEntries: await prisma.overtimeEntry.count({
        where: {
          foremanId: duplicateForemanId,
        },
      }),
      ppeOrders: await prisma.foremanPpeOrder.count({
        where: {
          foremanId: duplicateForemanId,
        },
      }),
    };

    if (remainingSiteDays > 0) {
      throw new Error(
        `Duplicate Foreman still owns ${remainingSiteDays} SiteDays.`,
      );
    }

    if (remainingTimesheets > 0) {
      throw new Error(
        `Duplicate Foreman still owns ${remainingTimesheets} Timesheets.`,
      );
    }

    const blockingDependencies = Object.entries(remainingDependencies).filter(
      ([, count]) => count > 0,
    );

    if (blockingDependencies.length > 0) {
      throw new Error(
        `Duplicate Foreman still has dependent rows: ${blockingDependencies
          .map(([name, count]) => `${name}=${count}`)
          .join(", ")}. ` +
          "Reassign those records before deleting the duplicate Foreman.",
      );
    }

    await prisma.foreman.delete({
      where: {
        id: duplicateForemanId,
      },
    });
  }

  console.log("");
  console.log("=".repeat(76));

  if (APPLY) {
    console.log("Thandazani merge completed.");
  } else {
    console.log("Preview completed. Nothing was changed.");
    console.log("Review the output, then run again with --apply.");
  }

  console.log(`SiteDays moved: ${movedSiteDays}`);
  console.log(`SiteDays merged: ${mergedSiteDays}`);
  console.log(`Attendance scans moved: ${movedScans}`);
  console.log(`Duplicate attendance scans removed: ${deletedDuplicateScans}`);
  console.log(`Timesheets moved: ${movedTimesheets}`);
  console.log(`Timesheets merged: ${mergedTimesheets}`);
  console.log(`Day acceptances moved: ${movedDayAcceptances}`);
  console.log(`Day acceptances merged: ${mergedDayAcceptances}`);
  console.log(`Deductions moved: ${movedDeductions}`);
  console.log(`Supervisor links moved: ${movedSupervisorLinks}`);
  console.log(`Supervisor links merged: ${mergedSupervisorLinks}`);
  console.log(`Site assignments moved: ${movedSiteAssignments}`);
  console.log(`Site assignments merged: ${mergedSiteAssignments}`);
}

main()
  .catch((error) => {
    console.error("Thandazani merge failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
