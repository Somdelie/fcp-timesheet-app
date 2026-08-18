"use server";

import bcrypt from "bcryptjs";
import { requireServerAuth } from "@/lib/auth-server";
import { employeeWhereFor } from "@/lib/employee-scope";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

export type EmployeeDTO = {
  id: string;
  firstName: string;
  lastName: string;
  qrCodeValue: string;
  defaultDayRate: string | null; // null means use company default
  faceImageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  phone?: string | null;
  createdByRole?: string | null; // ADMIN, SUPERVISOR, or FOREMAN
  createdByUserId?: string | null;
  createdByUserName?: string | null;
  userId?: string | null; // If employee has been promoted to foreman
  linkedToForemanId?: string | null; // If linked to a foreman via ForemanEmployee
  isSheRep?: boolean;
};

/** Return a phone string only if it looks like a real phone number (not an email). */
function sanitizePhone(
  ...candidates: (string | null | undefined)[]
): string | null {
  for (const v of candidates) {
    const s = (v ?? "").trim();
    if (s && !s.includes("@")) return s;
  }
  return null;
}

function serializeEmployee(e: any): EmployeeDTO & { isForeman: boolean } {
  // Check if employee is an assistant to a foreman (has active ForemanAssistant link)
  const linkedToForemanId = e.assistantLinks?.[0]?.foremanId ?? null;
  // Check if employee IS a foreman (has user with FOREMAN role and foreman record)
  const isForeman = !!(e.user?.role === "FOREMAN" && e.user?.foreman);

  return {
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    qrCodeValue: e.qrCodeValue,
    defaultDayRate: e.defaultDayRate ? String(e.defaultDayRate) : null, // ✅ Decimal -> string or null
    faceImageUrl: e.faceImageUrl ?? null,
    isActive: Boolean(e.isActive),
    phone: sanitizePhone(e.phone, e.user?.phone),
    createdAt:
      e.createdAt instanceof Date
        ? e.createdAt.toISOString()
        : String(e.createdAt),
    createdByRole: e.createdByUser?.role ?? null,
    createdByUserId: e.createdByUserId ?? null,
    createdByUserName: e.createdByUser?.name ?? null,
    userId: e.userId ?? null,
    linkedToForemanId,
    isForeman,
    isSheRep: !!e.user?.isSheRep,
  };
}

function parseMoneyToDecimalString(v: unknown) {
  const s = String(v ?? "")
    .trim()
    .replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
}

function generateEmployeeQrValue() {
  // Generate a unique QR code value - database is source of truth, no prefix required
  const token = randomBytes(8).toString("hex").toUpperCase();
  return token;
}

function revalidatePeoplePaths() {
  revalidatePath("/employees");
  revalidatePath("/admin/people");
}

export async function listEmployees(input?: {
  q?: string;
  show?: "active" | "all";
  createdByUserId?: string;
  take?: number;
}) {
  const auth = await requireServerAuth();
  const whereScope = employeeWhereFor(auth);

  const q = (input?.q ?? "").trim();
  const onlyActive = (input?.show ?? "active") !== "all";
  const take = Math.min(Math.max(input?.take ?? 1500, 1), 2000);
  const createdByUserId = input?.createdByUserId || undefined;

  const sharedSelect = {
    id: true,
    firstName: true,
    lastName: true,
    qrCodeValue: true,
    defaultDayRate: true,
    faceImageUrl: true,
    isActive: true,
    createdAt: true,
    phone: true,
    userId: true,
    user: {
      select: {
        role: true,
        phone: true,
        isSheRep: true,
        foreman: { select: { id: true } },
      },
    },
    createdByUserId: true,
    createdByUser: {
      select: {
        id: true,
        name: true,
        role: true,
      },
    },
    assistantLinks: {
      where: { endsOn: null },
      select: { foremanId: true },
      take: 1,
    },
  } as const;

  const activeFilter = onlyActive ? { isActive: true } : {};
  const creatorFilter = createdByUserId ? { createdByUserId } : {};
  const searchFilter = q
    ? {
        OR: [
          { firstName: { contains: q, mode: "insensitive" as const } },
          { lastName: { contains: q, mode: "insensitive" as const } },
          { qrCodeValue: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  // Always fetch ALL foremen employees regardless of the take limit — foremen
  // added earlier would otherwise fall off the newest-first page.
  const [foremenEmployees, regularEmployees] = await Promise.all([
    prisma.employee.findMany({
      where: {
        ...whereScope,
        ...activeFilter,
        ...creatorFilter,
        ...searchFilter,
        user: { role: "FOREMAN", foreman: { isNot: null } },
      },
      orderBy: { createdAt: "desc" },
      select: sharedSelect,
    }),
    prisma.employee.findMany({
      where: {
        ...whereScope,
        ...activeFilter,
        ...creatorFilter,
        ...searchFilter,
        NOT: { user: { role: "FOREMAN" } },
      },
      orderBy: { createdAt: "desc" },
      take,
      select: sharedSelect,
    }),
  ]);

  // Merge and keep newest additions first by default.
  const foremanIds = new Set(foremenEmployees.map((e) => e.id));
  const merged = [...foremenEmployees, ...regularEmployees]
    .filter((e, index, arr) => {
      if (!foremanIds.has(e.id)) return true;
      return arr.findIndex((item) => item.id === e.id) === index;
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    ok: true as const,
    employees: merged.map(serializeEmployee),
  };
}

export async function createEmployee(input: {
  firstName: string;
  lastName: string;
  phone?: string | null;
  faceImageUrl?: string | null;
  isActive?: boolean;
}) {
  const auth = await requireServerAuth();

  // Verify the user exists before using as createdByUserId
  const userExists = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true },
  });
  const createdByUserId = userExists ? auth.userId : null;

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();

  if (!firstName)
    return { ok: false as const, error: "First name is required." };
  if (!lastName) return { ok: false as const, error: "Last name is required." };

  const faceImageUrl = (input.faceImageUrl ?? "").trim() || null;
  const phone = (input.phone ?? "").trim() || null;
  const isActive = input.isActive ?? true;

  // Get default day rate from company settings
  const settings = await prisma.companySettings.findUnique({
    where: { id: "singleton" },
  });
  // Convert to string for consistent Decimal handling
  const dayRate = settings?.defaultEmployeeDayRate
    ? String(settings.defaultEmployeeDayRate)
    : "0";

  const MAX_TRIES = 5;

  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    const qrCodeValue = generateEmployeeQrValue();

    try {
      const created = await prisma.$transaction(async (tx) => {
        const employee = await tx.employee.create({
          data: {
            firstName,
            lastName,
            phone,
            qrCodeValue,
            faceImageUrl,
            isActive,
            defaultDayRate: dayRate as any,
            createdByUser: createdByUserId
              ? { connect: { id: createdByUserId } }
              : undefined,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            qrCodeValue: true,
            defaultDayRate: true,
            faceImageUrl: true,
            phone: true,
            isActive: true,
            createdAt: true,
            createdByUser: {
              select: {
                role: true,
              },
            },
            foremanLinks: {
              select: {
                foremanId: true,
              },
              take: 1,
            },
          },
        });

        // If foreman created this employee, link it to that foreman
        if (auth.role === "FOREMAN") {
          const foreman = await tx.foreman.findUnique({
            where: { userId: auth.userId },
            select: { id: true },
          });

          if (foreman) {
            await tx.foremanEmployee.upsert({
              where: {
                foremanId_employeeId: {
                  foremanId: foreman.id,
                  employeeId: employee.id,
                },
              },
              update: { reason: "created" },
              create: {
                foreman: { connect: { id: foreman.id } },
                employee: { connect: { id: employee.id } },
                reason: "created",
              },
            });
          }
        }
        revalidatePeoplePaths();
        return employee;
      });

      return { ok: true as const, employee: serializeEmployee(created) };
    } catch (e: any) {
      console.error("Error creating team member:", e);
      if (String(e?.code) === "P2002") {
        const target = e?.meta?.target;
        const t = Array.isArray(target)
          ? target.join(",")
          : String(target ?? "");

        if (t.includes("qrCodeValue")) continue; // retry collision
        return {
          ok: false as const,
          error: "Team violates a unique constraint.",
        };
      }
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false as const,
        error: `Failed to create team member: ${message}`,
      };
    }
  }

  return {
    ok: false as const,
    error: "Failed to generate unique QR. Try again.",
  };
}

export async function updateEmployee(input: {
  id: string;
  firstName?: string;
  lastName?: string;
  faceImageUrl?: string | null;
  isActive?: boolean;
  defaultDayRate?: string | null;
  phone?: string | null;
  isSheRep?: boolean;
}) {
  const auth = await requireServerAuth();
  const whereScope = employeeWhereFor(auth);

  const id = input.id;
  const data: any = {};

  if (input.firstName !== undefined) {
    const v = input.firstName.trim();
    if (!v) return { ok: false as const, error: "First name cannot be empty." };
    data.firstName = v;
  }
  if (input.lastName !== undefined) {
    const v = input.lastName.trim();
    if (!v) return { ok: false as const, error: "Last name cannot be empty." };
    data.lastName = v;
  }
  if (input.faceImageUrl !== undefined)
    data.faceImageUrl = (input.faceImageUrl ?? "").trim() || null;
  if (input.phone !== undefined)
    data.phone = (input.phone ?? "").trim() || null;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const canSee = await prisma.employee.findFirst({
    where: { id, ...whereScope },
    select: { id: true, userId: true, user: { select: { role: true } } },
  });
  if (!canSee) return { ok: false as const, error: "Not found." };

  const isForemanEmployee = !!canSee.userId && canSee.user?.role === "FOREMAN";

  // Prevent name edits for foreman employees; these are managed via the user profile
  if (isForemanEmployee && ("firstName" in data || "lastName" in data)) {
    return {
      ok: false as const,
      error: "Foreman names can only be updated on the user profile.",
    };
  }

  if (input.defaultDayRate !== undefined) {
    // Only foreman employees can have their day rate updated
    if (!canSee.userId) {
      return {
        ok: false as const,
        error: "Only foreman employees can have their day rate updated.",
      };
    }
    const dayRate = parseMoneyToDecimalString(input.defaultDayRate);
    if (dayRate !== null) {
      data.defaultDayRate = dayRate as any;
    }
  }

  const employee = await prisma.employee.update({
    where: { id },
    data,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      defaultDayRate: true,
      faceImageUrl: true,
      phone: true,
      isActive: true,
      createdAt: true,
      createdByUser: {
        select: {
          role: true,
        },
      },
      user: {
        select: {
          phone: true,
          isSheRep: true,
        },
      },
      foremanLinks: {
        select: {
          foremanId: true,
        },
        take: 1,
      },
    },
  });

  // Update isSheRep on the linked User if provided
  if (input.isSheRep !== undefined && canSee.userId && isForemanEmployee) {
    await prisma.user.update({
      where: { id: canSee.userId },
      data: { isSheRep: input.isSheRep },
    });
  }

  revalidatePeoplePaths();

  return { ok: true as const, employee: serializeEmployee(employee) };
}

export async function deactivateEmployee(input: { id: string }) {
  const auth = await requireServerAuth();
  const whereScope = employeeWhereFor(auth);

  const canSee = await prisma.employee.findFirst({
    where: { id: input.id, ...whereScope },
    select: { id: true },
  });
  if (!canSee) return { ok: false as const, error: "Not found." };

  const employee = await prisma.employee.update({
    where: { id: input.id },
    data: { isActive: false },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      defaultDayRate: true,
      faceImageUrl: true,
      isActive: true,
      createdAt: true,
      createdByUser: {
        select: {
          role: true,
        },
      },
      foremanLinks: {
        select: {
          foremanId: true,
        },
        take: 1,
      },
    },
  });

  revalidatePeoplePaths();

  return { ok: true as const, employee: serializeEmployee(employee) };
}

export async function promoteEmployeeToForeman(input: { employeeId: string }) {
  const auth = await requireServerAuth();

  // Only ADMIN can promote
  if (auth.role !== "ADMIN") {
    return { ok: false as const, error: "Unauthorized. Admin only." };
  }

  const { employeeId } = input;

  // Verify employee exists and is not already promoted
  // Fetch with defaultDayRate to use for the foreman
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      defaultDayRate: true,
      userId: true,
    },
  });
  if (!employee) return { ok: false as const, error: "Team member not found." };
  if (employee.userId) {
    return { ok: false as const, error: "Team member is already a foreman." };
  }

  try {
    // Generate a temporary password (12 random characters)
    const temporaryPassword = randomBytes(8)
      .toString("hex")
      .slice(0, 12)
      .toUpperCase();

    // Hash the password with bcrypt
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    const result = await prisma.$transaction(async (tx) => {
      // Create a User account for the employee with proper password hash
      const emailUsername = `${employee.firstName.toLowerCase()}.${employee.lastName.toLowerCase()}`;
      const user = await tx.user.create({
        data: {
          email: `${emailUsername}@foreman.local`,
          password: passwordHash,
          name: `${employee.firstName} ${employee.lastName}`,
          role: "FOREMAN",
        },
      });

      // Create Foreman record with the employee's current day rate
      const foreman = await tx.foreman.create({
        data: {
          user: { connect: { id: user.id } },
          defaultDayRate: employee.defaultDayRate,
        },
      });

      // Update Employee to link to User
      await tx.employee.update({
        where: { id: employeeId },
        data: { user: { connect: { id: user.id } } },
      });

      // Create ForemanEmployee link to track the promotion
      await tx.foremanEmployee.create({
        data: {
          foreman: { connect: { id: foreman.id } },
          employee: { connect: { id: employee.id } },
          reason: "promoted",
        },
      });

      return {
        employeeId,
        foremanId: foreman.id,
        userId: user.id,
        email: user.email,
        temporaryPassword,
      };
    });

    revalidatePeoplePaths();
    return {
      ok: true as const,
      message: `${employee.firstName} ${employee.lastName} has been promoted to foreman.`,
      data: result,
    };
  } catch (error: any) {
    console.error("Error promoting employee:", error);
    if (error.code === "P2002") {
      return {
        ok: false as const,
        error: "An account for this employee already exists.",
      };
    }
    return {
      ok: false as const,
      error: "Failed to promote employee.",
    };
  }
}

export async function removeEmployeeForemanLink(input: {
  employeeId: string;
  foremanId: string;
}) {
  const auth = await requireServerAuth();

  // Only ADMIN can remove
  if (auth.role !== "ADMIN") {
    return { ok: false as const, error: "Unauthorized. Admin only." };
  }

  const { employeeId, foremanId } = input;

  // Check if link exists and was promoted (not created)
  const link = await prisma.foremanEmployee.findUnique({
    where: {
      foremanId_employeeId: {
        foremanId,
        employeeId,
      },
    },
  });

  if (!link) return { ok: false as const, error: "Link not found." };
  if (link.reason === "created") {
    return {
      ok: false as const,
      error: "Cannot remove a foreman-created employee link.",
    };
  }

  // Remove the link
  await prisma.foremanEmployee.delete({
    where: {
      foremanId_employeeId: {
        foremanId,
        employeeId,
      },
    },
  });

  revalidatePeoplePaths();
  return { ok: true as const, message: "Employee foreman link removed." };
}

/**
 * Return the distinct users who have created at least one employee.
 * Used for the "Created by" filter dropdown on the employees page.
 */
export async function listEmployeeCreators() {
  const auth = await requireServerAuth();
  const whereScope = employeeWhereFor(auth);

  const creators = await prisma.employee.findMany({
    where: {
      ...whereScope,
      createdByUserId: { not: null },
    },
    select: {
      createdByUserId: true,
      createdByUser: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
    distinct: ["createdByUserId"],
    orderBy: { createdByUser: { name: "asc" } },
  });

  return creators
    .filter((c) => c.createdByUser)
    .map((c) => ({
      id: c.createdByUser!.id,
      name: c.createdByUser!.name ?? c.createdByUser!.id,
      role: c.createdByUser!.role,
    }));
}
