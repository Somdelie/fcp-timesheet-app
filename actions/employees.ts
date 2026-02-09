"use server";

import bcrypt from "bcryptjs";
import { requireServerAuth } from "@/lib/auth-server";
import { employeeWhereFor } from "@/lib/employee-scope";
import { prisma } from "@/lib/prisma";
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
  createdByRole?: string | null; // ADMIN, SUPERVISOR, or FOREMAN
  userId?: string | null; // If employee has been promoted to foreman
  linkedToForemanId?: string | null; // If linked to a foreman via ForemanEmployee
};

function serializeEmployee(e: any): EmployeeDTO {
  // Check if employee is an assistant to a foreman (has active ForemanAssistant link)
  const linkedToForemanId = e.assistantLinks?.[0]?.foremanId ?? null;
  return {
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    qrCodeValue: e.qrCodeValue,
    defaultDayRate: e.defaultDayRate ? String(e.defaultDayRate) : null, // ✅ Decimal -> string or null
    faceImageUrl: e.faceImageUrl ?? null,
    isActive: Boolean(e.isActive),
    createdAt:
      e.createdAt instanceof Date
        ? e.createdAt.toISOString()
        : String(e.createdAt),
    createdByRole: e.createdByUser?.role ?? null,
    userId: e.userId ?? null,
    linkedToForemanId,
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

export async function listEmployees(input?: {
  q?: string;
  show?: "active" | "all";
  take?: number;
}) {
  const auth = await requireServerAuth();
  const whereScope = employeeWhereFor(auth);

  const q = (input?.q ?? "").trim();
  const onlyActive = (input?.show ?? "active") !== "all";
  const take = Math.min(Math.max(input?.take ?? 200, 1), 500);

  const employees = await prisma.employee.findMany({
    where: {
      ...whereScope,
      ...(onlyActive ? { isActive: true } : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { qrCodeValue: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      defaultDayRate: true,
      faceImageUrl: true,
      isActive: true,
      createdAt: true,
      userId: true,
      createdByUser: {
        select: {
          role: true,
        },
      },
      assistantLinks: {
        where: {
          endsOn: null, // Only active assistant links
        },
        select: {
          foremanId: true,
        },
        take: 1,
      },
    },
  });

  return { ok: true as const, employees: employees.map(serializeEmployee) };
}

export async function createEmployee(input: {
  firstName: string;
  lastName: string;
  faceImageUrl?: string | null;
  isActive?: boolean;
}) {
  const auth = await requireServerAuth();

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();

  if (!firstName)
    return { ok: false as const, error: "First name is required." };
  if (!lastName) return { ok: false as const, error: "Last name is required." };

  const faceImageUrl = (input.faceImageUrl ?? "").trim() || null;
  const isActive = input.isActive ?? true;

  // Get default day rate from company settings
  const settings = await prisma.companySettings.findUnique({
    where: { id: "singleton" },
  });
  const dayRate = settings?.defaultEmployeeDayRate || "0";

  const MAX_TRIES = 5;

  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    const qrCodeValue = generateEmployeeQrValue();

    try {
      const created = await prisma.$transaction(async (tx) => {
        const employee = await tx.employee.create({
          data: {
            firstName,
            lastName,
            qrCodeValue,
            faceImageUrl,
            isActive,
            defaultDayRate: dayRate as any,
            createdByUserId: auth.userId,
          },
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
                foremanId: foreman.id,
                employeeId: employee.id,
                reason: "created",
              },
            });
          }
        }
        revalidatePath("/employees");
        return employee;
      });

      return { ok: true as const, employee: serializeEmployee(created) };
    } catch (e: any) {
      if (String(e?.code) === "P2002") {
        const target = e?.meta?.target;
        const t = Array.isArray(target)
          ? target.join(",")
          : String(target ?? "");
        if (t.includes("qrCodeValue")) continue; // retry collision
        return {
          ok: false as const,
          error: "Employee violates a unique constraint.",
        };
      }
      return { ok: false as const, error: "Failed to create employee." };
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
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const canSee = await prisma.employee.findFirst({
    where: { id, ...whereScope },
    select: { id: true, userId: true },
  });
  if (!canSee) return { ok: false as const, error: "Not found." };

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
  if (!employee) return { ok: false as const, error: "Employee not found." };
  if (employee.userId) {
    return { ok: false as const, error: "Employee is already a foreman." };
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
          userId: user.id,
          defaultDayRate: employee.defaultDayRate,
        },
      });

      // Update Employee to link to User
      await tx.employee.update({
        where: { id: employeeId },
        data: { userId: user.id },
      });

      // Create ForemanEmployee link to track the promotion
      await tx.foremanEmployee.create({
        data: {
          foremanId: foreman.id,
          employeeId: employee.id,
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

    revalidatePath("/employees");
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

  revalidatePath("/employees");
  return { ok: true as const, message: "Employee foreman link removed." };
}
