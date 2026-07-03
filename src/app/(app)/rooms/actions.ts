"use server";

import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { roomSchema } from "@/lib/validation";

export interface RoomFormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createRoomAction(
  _prev: RoomFormState | null,
  formData: FormData
): Promise<RoomFormState> {
  const user = await requireAccess("rooms");
  const amenities = String(formData.get("amenities") ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  const parsed = roomSchema.safeParse({
    number: formData.get("number"),
    type: formData.get("type"),
    floor: formData.get("floor"),
    maxOccupancy: formData.get("maxOccupancy"),
    baseRate: formData.get("baseRate"),
    amenities,
  });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[i.path.join(".")] = i.message;
    return { fieldErrors: fe };
  }
  try {
    const room = await prisma.room.create({ data: parsed.data });
    await logAudit({ userId: user.id, action: "room.create", entityType: "Room", entityId: room.id });
  } catch {
    return { error: "A room with that number already exists." };
  }
  revalidatePath("/rooms");
  return { ok: true };
}

export async function setRoomStatusAction(roomId: string, status: "ACTIVE" | "OUT_OF_ORDER") {
  const user = await requireAccess("rooms");
  await prisma.room.update({ where: { id: roomId }, data: { status } });
  await logAudit({ userId: user.id, action: "room.status", entityType: "Room", entityId: roomId, details: { status } });
  revalidatePath("/rooms");
  revalidatePath("/calendar");
}

export async function addOutOfOrderAction(
  roomId: string,
  startDate: string,
  endDate: string,
  reason: string
) {
  const user = await requireAccess("rooms");
  if (!(endDate > startDate)) return { error: "End date must be after start date." };
  await prisma.roomOutOfOrder.create({
    data: {
      roomId,
      startDate: new Date(`${startDate}T00:00:00.000Z`),
      endDate: new Date(`${endDate}T00:00:00.000Z`),
      reason: reason.trim() || "Out of order",
    },
  });
  await logAudit({ userId: user.id, action: "room.ooo.add", entityType: "Room", entityId: roomId, details: { startDate, endDate } });
  revalidatePath("/rooms");
  revalidatePath("/calendar");
  return { ok: true };
}

export async function removeOutOfOrderAction(id: string) {
  const user = await requireAccess("rooms");
  const block = await prisma.roomOutOfOrder.delete({ where: { id } });
  await logAudit({ userId: user.id, action: "room.ooo.remove", entityType: "Room", entityId: block.roomId });
  revalidatePath("/rooms");
  revalidatePath("/calendar");
}
