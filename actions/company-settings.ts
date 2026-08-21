"use server";

import { requireServerAuth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeAuditEvent } from "@/lib/audit";

export type CompanySettingsDTO = {
  id: string;
  defaultEmployeeDayRate: string; // keep as string to avoid float rounding issues
  defaultPainterDayRate: string;
  defaultBuildingDayRate: string;
  defaultSpecialCoatingsDayRate: string;
  defaultCapeTownDayRate: string;
  teamRates: CompanyTeamRateDTO[];
  fingerprintMandatory: boolean;
  scanOutFaceEnabled: boolean;
  scanOutPhotoEnabled: boolean;
  updatedAt: string;
};

export type CompanyTeamRateDTO = {
  id: string;
  code: string;
  name: string;
  dayRate: string;
  isSystem: boolean;
  sortOrder: number;
};

const SYSTEM_TEAM_RATES = [
  { code: "PAINTERS", name: "Painters", dayRate: "250.00", sortOrder: 10 },
  { code: "BUILDING", name: "Building", dayRate: "300.00", sortOrder: 20 },
  {
    code: "SPECIAL_COATINGS",
    name: "Special Coatings",
    dayRate: "270.00",
    sortOrder: 30,
  },
  { code: "CAPE_TOWN", name: "Cape Town", dayRate: "270.00", sortOrder: 40 },
] as const;

const TEAM_RATE_CONFIRMATION_CODE = "@FCP_2026";

function isValidTeamRateConfirmationCode(code: unknown) {
  return String(code ?? "") === TEAM_RATE_CONFIRMATION_CODE;
}

function normalizeTeamCode(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function serializeTeamRate(t: any): CompanyTeamRateDTO {
  return {
    id: t.id,
    code: t.code,
    name: t.name,
    dayRate: String(t.dayRate),
    isSystem: Boolean(t.isSystem),
    sortOrder: Number(t.sortOrder ?? 100),
  };
}

async function ensureSystemTeamRates() {
  const existing = await prisma.companyTeamRate.findMany({
    select: { code: true },
  });
  const existingCodes = new Set(existing.map((row) => row.code));

  for (const team of SYSTEM_TEAM_RATES) {
    if (existingCodes.has(team.code)) continue;

    await prisma.companyTeamRate.create({
      data: {
        code: team.code,
        name: team.name,
        dayRate: team.dayRate as any,
        isSystem: true,
        sortOrder: team.sortOrder,
      },
    });
  }

  await prisma.companyTeamRate.updateMany({
    where: { code: "PAINTERS", dayRate: 0 as any },
    data: { dayRate: "250.00" as any },
  });
}

function serializeSettings(s: any, teamRates: any[] = []): CompanySettingsDTO {
  return {
    id: s.id,
    defaultEmployeeDayRate: String(s.defaultEmployeeDayRate),
    defaultPainterDayRate: String(s.defaultPainterDayRate ?? "250"),
    defaultBuildingDayRate: String(s.defaultBuildingDayRate ?? "0"),
    defaultSpecialCoatingsDayRate: String(
      s.defaultSpecialCoatingsDayRate ?? "0",
    ),
    defaultCapeTownDayRate: String(s.defaultCapeTownDayRate ?? "0"),
    teamRates: teamRates.map(serializeTeamRate),
    fingerprintMandatory: Boolean(s.fingerprintMandatory),
    scanOutFaceEnabled: s.scanOutFaceEnabled ?? true,
    scanOutPhotoEnabled: s.scanOutPhotoEnabled ?? true,
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
        defaultPainterDayRate: 250,
      },
    });
  }

  await ensureSystemTeamRates();
  const teamRates = await prisma.companyTeamRate.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return { ok: true as const, settings: serializeSettings(settings, teamRates) };
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
 * Global fingerprint rollout gate. Stays false (fingerprint optional,
 * QR/photo attendance always available) until an admin explicitly flips
 * it — a deliberate future decision, never a side effect of anything else.
 */
export async function updateFingerprintMandatorySetting(input: {
  fingerprintMandatory: boolean;
}) {
  const auth = await requireServerAuth();

  if (auth.role !== "ADMIN") {
    return { ok: false as const, error: "Unauthorized. Admin only." };
  }

  const result = await prisma.companySettings.upsert({
    where: { id: "singleton" },
    update: { fingerprintMandatory: input.fingerprintMandatory },
    create: {
      id: "singleton",
      defaultEmployeeDayRate: 0,
      fingerprintMandatory: input.fingerprintMandatory,
    },
  });

  await writeAuditEvent({
    actorUserId: auth.userId,
    action: "company_settings_fingerprint_mandatory_updated",
    entity: "CompanySettings",
    entityId: "singleton",
    metadata: { fingerprintMandatory: input.fingerprintMandatory },
  });

  revalidatePath("/settings");
  return { ok: true as const, settings: serializeSettings(result) };
}

/**
 * Which scan-out flows the foreman app offers. Both on by default; an admin
 * can turn either off once the other is trusted enough to stand alone, but
 * at least one must always stay enabled or foremen would have no way to
 * scan out at all.
 */
export async function updateScanOutMethodSettings(input: {
  scanOutFaceEnabled: boolean;
  scanOutPhotoEnabled: boolean;
}) {
  const auth = await requireServerAuth();

  if (auth.role !== "ADMIN") {
    return { ok: false as const, error: "Unauthorized. Admin only." };
  }

  if (!input.scanOutFaceEnabled && !input.scanOutPhotoEnabled) {
    return {
      ok: false as const,
      error: "At least one scan-out method must stay enabled.",
    };
  }

  const result = await prisma.companySettings.upsert({
    where: { id: "singleton" },
    update: {
      scanOutFaceEnabled: input.scanOutFaceEnabled,
      scanOutPhotoEnabled: input.scanOutPhotoEnabled,
    },
    create: {
      id: "singleton",
      defaultEmployeeDayRate: 0,
      scanOutFaceEnabled: input.scanOutFaceEnabled,
      scanOutPhotoEnabled: input.scanOutPhotoEnabled,
    },
  });

  await writeAuditEvent({
    actorUserId: auth.userId,
    action: "company_settings_scan_out_method_updated",
    entity: "CompanySettings",
    entityId: "singleton",
    metadata: {
      scanOutFaceEnabled: input.scanOutFaceEnabled,
      scanOutPhotoEnabled: input.scanOutPhotoEnabled,
    },
  });

  revalidatePath("/settings");
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
  defaultCapeTownDayRate?: string | number;
  teamRates?: Array<{
    code?: string;
    name: string;
    dayRate: string | number;
    isSystem?: boolean;
    sortOrder?: number;
  }>;
  confirmationCode?: string;
}) {
  const auth = await requireServerAuth();

  if (auth.role !== "ADMIN") {
    return { ok: false as const, error: "Unauthorized. Admin only." };
  }

  const data: Record<string, unknown> = {};
  const teamRateInputs = input.teamRates ?? [];

  if (
    teamRateInputs.length > 0 &&
    !isValidTeamRateConfirmationCode(input.confirmationCode)
  ) {
    return { ok: false as const, error: "Invalid confirmation code." };
  }

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
  if (input.defaultCapeTownDayRate !== undefined) {
    const v = parseMoneyAllowZero(input.defaultCapeTownDayRate);
    if (v === null)
      return { ok: false as const, error: "Cape Town day rate is invalid." };
    data.defaultCapeTownDayRate = v;
  }

  if (Object.keys(data).length === 0) {
    if (teamRateInputs.length === 0) {
      return { ok: false as const, error: "No team rates provided." };
    }
  }

  const normalizedTeamRates = teamRateInputs.map((team, index) => {
    const name = String(team.name ?? "").trim();
    const code = normalizeTeamCode(String(team.code || name));
    const dayRate = parseMoneyAllowZero(team.dayRate);
    if (!name || !code) {
      throw new Error("Team name is required.");
    }
    if (dayRate === null) {
      throw new Error(`${name} day rate is invalid.`);
    }
    return {
      code,
      name,
      dayRate,
      isSystem: Boolean(team.isSystem),
      sortOrder: Number(team.sortOrder ?? (index + 1) * 10),
    };
  });

  const seenCodes = new Set<string>();
  for (const team of normalizedTeamRates) {
    if (seenCodes.has(team.code)) {
      return { ok: false as const, error: `Duplicate team: ${team.name}` };
    }
    seenCodes.add(team.code);
  }

  if (Object.keys(data).length === 0 && normalizedTeamRates.length === 0) {
    return { ok: false as const, error: "No team rates provided." };
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedSettings = await tx.companySettings.upsert({
      where: { id: "singleton" },
      update: data,
      create: {
        id: "singleton",
        defaultEmployeeDayRate: 0,
        defaultPainterDayRate: 250,
        ...data,
      },
    });

    for (const team of normalizedTeamRates) {
      await tx.companyTeamRate.upsert({
        where: { code: team.code },
        update: {
          name: team.name,
          dayRate: team.dayRate as any,
          sortOrder: team.sortOrder,
        },
        create: {
          code: team.code,
          name: team.name,
          dayRate: team.dayRate as any,
          isSystem: team.isSystem,
          sortOrder: team.sortOrder,
        },
      });
    }

    return updatedSettings;
  });

  revalidatePath("/settings");
  revalidatePath("/foreman");
  revalidatePath("/admin/foremen");

  const teamRates = await prisma.companyTeamRate.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return { ok: true as const, settings: serializeSettings(result, teamRates) };
}

export async function verifyTeamRateConfirmationCode(input: {
  confirmationCode: string;
}) {
  const auth = await requireServerAuth();

  if (auth.role !== "ADMIN") {
    return { ok: false as const, error: "Unauthorized. Admin only." };
  }

  if (!isValidTeamRateConfirmationCode(input.confirmationCode)) {
    return { ok: false as const, error: "Invalid confirmation code." };
  }

  return { ok: true as const };
}

export async function deleteTeamRate(input: {
  code: string;
  confirmationCode: string;
}) {
  const auth = await requireServerAuth();

  if (auth.role !== "ADMIN") {
    return { ok: false as const, error: "Unauthorized. Admin only." };
  }
  if (!isValidTeamRateConfirmationCode(input.confirmationCode)) {
    return { ok: false as const, error: "Invalid confirmation code." };
  }

  const code = normalizeTeamCode(input.code);
  if (!code) {
    return { ok: false as const, error: "Team code is required." };
  }

  const team = await prisma.companyTeamRate.findUnique({
    where: { code },
    select: { code: true, name: true },
  });
  if (!team) {
    return { ok: false as const, error: "Team not found." };
  }

  const assignedForemen = await prisma.foreman.count({
    where: { defaultTeam: code },
  });
  if (assignedForemen > 0) {
    return {
      ok: false as const,
      error: `Cannot delete ${team.name}. ${assignedForemen} foreman(s) still use this team.`,
    };
  }

  await prisma.companyTeamRate.delete({ where: { code } });

  revalidatePath("/settings");
  revalidatePath("/foreman");
  revalidatePath("/admin/foremen");

  return { ok: true as const };
}

export async function getTeamRateOptions() {
  const auth = await requireServerAuth();

  if (!["ADMIN", "SUPERVISOR", "FOREMAN"].includes(auth.role)) {
    return { ok: false as const, error: "Unauthorized." };
  }

  await ensureSystemTeamRates();
  const teams = await prisma.companyTeamRate.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return { ok: true as const, teams: teams.map(serializeTeamRate) };
}
