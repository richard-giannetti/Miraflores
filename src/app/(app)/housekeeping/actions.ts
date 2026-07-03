"use server";

import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { HousekeepingStatus } from "@prisma/client";

const VALID: HousekeepingStatus[] = ["DIRTY", "CLEANING", "CLEAN", "INSPECTED"];

export async function setHousekeepingStatus(roomId: string, status: HousekeepingStatus) {
  const user = await requireAccess("housekeeping");
  if (!VALID.includes(status)) throw new Error("Invalid status");
  await prisma.room.update({ where: { id: roomId }, data: { housekeepingStatus: status } });
  await logAudit({
    userId: user.id,
    action: "housekeeping.status",
    entityType: "Room",
    entityId: roomId,
    details: { status },
  });
  revalidatePath("/housekeeping");
  revalidatePath("/calendar");
  revalidatePath("/");
}

export async function setHousekeepingNote(roomId: string, note: string) {
  const user = await requireAccess("housekeeping");
  await prisma.room.update({
    where: { id: roomId },
    data: { housekeepingNote: note.trim() || null },
  });
  await logAudit({
    userId: user.id,
    action: "housekeeping.note",
    entityType: "Room",
    entityId: roomId,
    details: { note },
  });
  revalidatePath("/housekeeping");
}
