"use server";

import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { writeAuditEvent } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { SA_BANKS, type SaBankName } from "@/lib/sa-banks";

export async function updateForemanBankName(input: {
  foremanId: string;
  bankName: SaBankName | null;
}) {
  const auth = await requireServerAuth();

  if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR") {
    return { ok: false as const, error: "Forbidden. Admin or Supervisor only." };
  }

  const foremanId = String(input.foremanId ?? "").trim();
  const bankName = input.bankName ?? null;

  if (!foremanId) {
    return { ok: false as const, error: "foremanId is required." };
  }
  if (bankName !== null && !(SA_BANKS as readonly string[]).includes(bankName)) {
    return { ok: false as const, error: `Invalid bank name.` };
  }

  const foreman = await prisma.foreman.findUnique({
    where: { id: foremanId },
    select: {
      id: true,
      bankName: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!foreman) {
    return { ok: false as const, error: "Foreman not found." };
  }

  const oldBankName = foreman.bankName;

  await prisma.foreman.update({
    where: { id: foremanId },
    data: { bankName },
  });

  await writeAuditEvent({
    actorUserId: auth.userId,
    action: "FOREMAN_BANK_UPDATE",
    entity: "Foreman",
    entityId: foremanId,
    metadata: {
      title: "Foreman bank name updated",
      description: `${foreman.user.name ?? foreman.user.email} bank changed from ${oldBankName ?? "none"} to ${bankName ?? "none"}`,
      foremanId,
      foremanName: foreman.user.name ?? foreman.user.email,
      oldBankName,
      newBankName: bankName,
      changedByUserId: auth.userId,
    },
  });

  revalidatePath("/admin/foremen");

  return {
    ok: true as const,
    message: `Bank name updated to ${bankName ?? "none"}.`,
    foreman: { id: foreman.id, bankName },
  };
}
