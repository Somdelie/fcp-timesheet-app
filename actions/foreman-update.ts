"use server";

import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { writeAuditEvent } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { SA_BANKS, type SaBankName } from "@/lib/sa-banks";

export async function updateForeman(input: {
  foremanId: string;
  name: string;
  defaultDayRate: string | null;
  bankName: SaBankName | null;
}) {
  const auth = await requireServerAuth();

  if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR") {
    return { ok: false as const, error: "Forbidden. Admin or Supervisor only." };
  }

  const foremanId = String(input.foremanId ?? "").trim();
  const name = String(input.name ?? "").trim();
  const bankName = input.bankName ?? null;

  if (!foremanId) return { ok: false as const, error: "foremanId is required." };
  if (!name || name.length < 2) return { ok: false as const, error: "Name must be at least 2 characters." };
  if (bankName !== null && !(SA_BANKS as readonly string[]).includes(bankName)) {
    return { ok: false as const, error: "Invalid bank name." };
  }

  let defaultDayRate: string | null = null;
  if (input.defaultDayRate) {
    const parsed = parseFloat(String(input.defaultDayRate).replace(",", "."));
    if (isNaN(parsed) || parsed < 0) {
      return { ok: false as const, error: "Invalid day rate." };
    }
    defaultDayRate = parsed.toFixed(2);
  }

  const foreman = await prisma.foreman.findUnique({
    where: { id: foremanId },
    select: {
      id: true,
      defaultDayRate: true,
      bankName: true,
      user: { select: { id: true, name: true } },
    },
  });

  if (!foreman) return { ok: false as const, error: "Foreman not found." };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: foreman.user.id },
      data: { name },
    }),
    prisma.foreman.update({
      where: { id: foremanId },
      data: {
        defaultDayRate: defaultDayRate ?? null,
        bankName,
      },
    }),
  ]);

  await writeAuditEvent({
    actorUserId: auth.userId,
    action: "FOREMAN_UPDATED",
    entity: "Foreman",
    entityId: foremanId,
    metadata: {
      title: "Foreman updated",
      foremanId,
      oldName: foreman.user.name,
      newName: name,
      oldDayRate: foreman.defaultDayRate?.toString() ?? null,
      newDayRate: defaultDayRate,
      oldBankName: foreman.bankName,
      newBankName: bankName,
    },
  });

  revalidatePath("/admin/foremen");
  revalidatePath("/foreman");

  return { ok: true as const, message: "Foreman updated successfully." };
}
