import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Append an audit entry (R9). Failures here must never break the operation. */
export async function logAudit(entry: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        details: entry.details,
      },
    });
  } catch (err) {
    console.error("audit log failed", err);
  }
}
