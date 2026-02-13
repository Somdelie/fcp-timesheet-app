import { prisma } from "@/lib/prisma";

export type AuditEventInput = {
  actorUserId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: unknown;
};

type AuditDb = {
  auditEvent: {
    create: (args: {
      data: {
        actorUserId?: string | null;
        action: string;
        entity: string;
        entityId?: string | null;
        metadata?: unknown;
      };
    }) => Promise<unknown>;
  };
};

/**
 * Best-effort audit logging. Never throws.
 *
 * Use for system events shown in the dashboard Recent Activity.
 */
export async function writeAuditEvent(input: AuditEventInput, db?: AuditDb) {
  const client = db ?? (prisma as unknown as AuditDb);
  try {
    await client.auditEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: String(input.action),
        entity: String(input.entity),
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch {
    // Intentionally swallow to avoid breaking primary flows.
  }
}
