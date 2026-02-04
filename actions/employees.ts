"use server";

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
  defaultDayRate: string; // keep as string to avoid float rounding issues
  faceImageUrl: string | null;
  isActive: boolean;
  createdAt: string;
};

function serializeEmployee(e: any): EmployeeDTO {
  return {
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    qrCodeValue: e.qrCodeValue,
    defaultDayRate: String(e.defaultDayRate), // ✅ Decimal -> string
    faceImageUrl: e.faceImageUrl ?? null,
    isActive: Boolean(e.isActive),
    createdAt:
      e.createdAt instanceof Date
        ? e.createdAt.toISOString()
        : String(e.createdAt),
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
  const token = randomBytes(6).toString("base64url").toUpperCase();
  return `EMP_${token}`;
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
    },
  });

  return { ok: true as const, employees: employees.map(serializeEmployee) };
}

export async function createEmployee(input: {
  firstName: string;
  lastName: string;
  defaultDayRate: string | number;
  faceImageUrl?: string | null;
  isActive?: boolean;
}) {
  const auth = await requireServerAuth();

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const dayRate = parseMoneyToDecimalString(input.defaultDayRate);

  if (!firstName)
    return { ok: false as const, error: "First name is required." };
  if (!lastName) return { ok: false as const, error: "Last name is required." };
  if (!dayRate)
    return {
      ok: false as const,
      error: "Day rate must be a valid number > 0.",
    };

  const faceImageUrl = (input.faceImageUrl ?? "").trim() || null;
  const isActive = input.isActive ?? true;

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
            defaultDayRate: dayRate as any,
            faceImageUrl,
            isActive,
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
  defaultDayRate?: string | number;
  faceImageUrl?: string | null;
  isActive?: boolean;
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
  if (input.defaultDayRate !== undefined) {
    const dayRate = parseMoneyToDecimalString(input.defaultDayRate);
    if (!dayRate)
      return {
        ok: false as const,
        error: "Day rate must be a valid number > 0.",
      };
    data.defaultDayRate = dayRate as any;
  }
  if (input.faceImageUrl !== undefined)
    data.faceImageUrl = (input.faceImageUrl ?? "").trim() || null;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const canSee = await prisma.employee.findFirst({
    where: { id, ...whereScope },
    select: { id: true },
  });
  if (!canSee) return { ok: false as const, error: "Not found." };

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
    },
  });

  return { ok: true as const, employee: serializeEmployee(employee) };
}
