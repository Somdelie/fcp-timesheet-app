"use server";

import { requireServerAuth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type CompanySettingsDTO = {
  id: string;
  defaultEmployeeDayRate: string; // keep as string to avoid float rounding issues
  defaultPainterDayRate: string;
  defaultBuildingDayRate: string;
  defaultSpecialCoatingsDayRate: string;
  updatedAt: string;
};

function serializeSettings(s: any): CompanySettingsDTO {
  return {
    id: s.id,
    defaultEmployeeDayRate: String(s.defaultEmployeeDayRate),
    defaultPainterDayRate: String(s.defaultPainterDayRate ?? "0"),
    defaultBuildingDayRate: String(s.defaultBuildingDayRate ?? "0"),
    defaultSpecialCoatingsDayRate: String(
      s.defaultSpecialCoatingsDayRate ?? "0",
    ),
    updatedAt:
      s.updatedAt instanceof Date
        ? s.updatedAt.toISOString()
        : String(s.updatedAt),
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

export async function getCompanySettings() {
  const auth = await requireServerAuth();

  // Only ADMIN can view company settings
  if (auth.role !== "ADMIN") {
    return { ok: false as const, error: "Unauthorized. Admin only." };
  }

  let settings = await prisma.companySettings.findUnique({
    where: { id: "singleton" },
  });

  // Ensure singleton exists
  if (!settings) {
    settings = await prisma.companySettings.create({
      data: {
        id: "singleton",
        defaultEmployeeDayRate: 0,
      },
    });
  }

  return { ok: true as const, settings: serializeSettings(settings) };
}

export async function updateCompanySettings(input: {
  defaultEmployeeDayRate: string | number;
}) {
  const auth = await requireServerAuth();

  // Only ADMIN can update company settings
  if (auth.role !== "ADMIN") {
    return { ok: false as const, error: "Unauthorized. Admin only." };
  }

  const dayRate = parseMoneyToDecimalString(input.defaultEmployeeDayRate);
  if (!dayRate) {
    return {
      ok: false as const,
      error: "Day rate must be a valid number > 0.",
    };
  }

  let settings = await prisma.companySettings.findUnique({
    where: { id: "singleton" },
  });

  // Ensure singleton exists and update in a transaction
  const result = await prisma.$transaction(async (tx) => {
    let updatedSettings;
    if (!settings) {
      updatedSettings = await tx.companySettings.create({
        data: {
          id: "singleton",
          defaultEmployeeDayRate: dayRate as any,
        },
      });
    } else {
      updatedSettings = await tx.companySettings.update({
        where: { id: "singleton" },
        data: { defaultEmployeeDayRate: dayRate as any },
      });
    }

    // Update employees' default day rate:
    // - Apply new company default to all employees that are NOT foremen
    //   (employees promoted to foreman have a linked user with FOREMAN role
    //   and should keep their manually managed rate).
    await tx.employee.updateMany({
      where: {
        OR: [
          { userId: null }, // regular workers & assistants without user accounts
          {
            // employees with a linked user that is not a foreman
            user: {
              role: {
                not: "FOREMAN",
              },
            },
          },
        ],
      },
      data: { defaultDayRate: dayRate as any },
    });

    return updatedSettings;
  });

  revalidatePath("/settings");
  revalidatePath("/employees");
  return { ok: true as const, settings: serializeSettings(result) };
}

/**
 * Allows non-negative values (including 0) for team rates.
 * Returns null only if the input is not a valid finite number.
 */
function parseMoneyAllowZero(v: unknown): string | null {
  const s = String(v ?? "")
    .trim()
    .replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n.toFixed(2);
}

/**
 * Update team default day rates in CompanySettings.
 *
 * Accepts partial input — only provided fields are updated.
 */
export async function updateTeamDefaultRates(input: {
  defaultPainterDayRate?: string | number;
  defaultBuildingDayRate?: string | number;
  defaultSpecialCoatingsDayRate?: string | number;
}) {
  const auth = await requireServerAuth();

  if (auth.role !== "ADMIN") {
    return { ok: false as const, error: "Unauthorized. Admin only." };
  }

  const data: Record<string, unknown> = {};

  if (input.defaultPainterDayRate !== undefined) {
    const v = parseMoneyAllowZero(input.defaultPainterDayRate);
    if (v === null)
      return { ok: false as const, error: "Painter day rate is invalid." };
    data.defaultPainterDayRate = v;
  }
  if (input.defaultBuildingDayRate !== undefined) {
    const v = parseMoneyAllowZero(input.defaultBuildingDayRate);
    if (v === null)
      return { ok: false as const, error: "Building day rate is invalid." };
    data.defaultBuildingDayRate = v;
  }
  if (input.defaultSpecialCoatingsDayRate !== undefined) {
    const v = parseMoneyAllowZero(input.defaultSpecialCoatingsDayRate);
    if (v === null)
      return {
        ok: false as const,
        error: "Special Coatings day rate is invalid.",
      };
    data.defaultSpecialCoatingsDayRate = v;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false as const, error: "No team rates provided." };
  }

  const result = await prisma.companySettings.upsert({
    where: { id: "singleton" },
    update: data,
    create: {
      id: "singleton",
      defaultEmployeeDayRate: 0,
      ...data,
    },
  });

  revalidatePath("/settings");
  return { ok: true as const, settings: serializeSettings(result) };
}
