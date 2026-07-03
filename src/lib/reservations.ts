import "server-only";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import {
  findAvailableRooms,
  isOverlapConstraintError,
} from "@/lib/availability";
import { toDateStr } from "@/lib/dates";
import type { ReservationCreateInput } from "@/lib/validation";

export interface ConflictResult {
  ok: false;
  kind: "conflict";
  message: string;
  alternatives: { id: string; number: string; type: string; baseRate: number }[];
}
export interface OkResult {
  ok: true;
  id: string;
}
export type MutationResult = OkResult | ConflictResult | { ok: false; kind: "error"; message: string };

function toDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

async function suggestAlternatives(
  input: Pick<ReservationCreateInput, "checkIn" | "checkOut" | "adults" | "children">,
  ignoreReservationId?: string
) {
  const rooms = await findAvailableRooms({
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    minOccupancy: input.adults + input.children,
    ignoreReservationId,
  });
  return rooms
    .slice(0, 5)
    .map((r) => ({ id: r.id, number: r.number, type: r.type, baseRate: r.baseRate }));
}

export async function createReservation(
  input: ReservationCreateInput,
  actorId: string | null
): Promise<MutationResult> {
  try {
    const res = await prisma.reservation.create({
      data: {
        roomId: input.roomId,
        guestName: input.guestName.trim(),
        guestEmail: input.guestEmail || null,
        guestPhone: input.guestPhone || null,
        checkIn: toDate(input.checkIn),
        checkOut: toDate(input.checkOut),
        adults: input.adults,
        children: input.children,
        ratePerNight: input.ratePerNight,
        source: input.source,
        paymentStatus: input.paymentStatus,
        notes: input.notes || null,
        status: "CONFIRMED",
        createdById: actorId,
      },
    });
    await logAudit({
      userId: actorId,
      action: "reservation.create",
      entityType: "Reservation",
      entityId: res.id,
      details: { room: input.roomId, checkIn: input.checkIn, checkOut: input.checkOut },
    });
    return { ok: true, id: res.id };
  } catch (err) {
    if (isOverlapConstraintError(err)) {
      return {
        ok: false,
        kind: "conflict",
        message:
          "That room is already booked for one or more of those nights. Pick another room or dates.",
        alternatives: await suggestAlternatives(input),
      };
    }
    console.error("createReservation failed", err);
    return { ok: false, kind: "error", message: "Could not create the reservation." };
  }
}

export async function updateReservation(
  id: string,
  input: ReservationCreateInput,
  actorId: string | null
): Promise<MutationResult> {
  try {
    await prisma.reservation.update({
      where: { id },
      data: {
        roomId: input.roomId,
        guestName: input.guestName.trim(),
        guestEmail: input.guestEmail || null,
        guestPhone: input.guestPhone || null,
        checkIn: toDate(input.checkIn),
        checkOut: toDate(input.checkOut),
        adults: input.adults,
        children: input.children,
        ratePerNight: input.ratePerNight,
        source: input.source,
        paymentStatus: input.paymentStatus,
        notes: input.notes || null,
      },
    });
    await logAudit({
      userId: actorId,
      action: "reservation.update",
      entityType: "Reservation",
      entityId: id,
    });
    return { ok: true, id };
  } catch (err) {
    if (isOverlapConstraintError(err)) {
      return {
        ok: false,
        kind: "conflict",
        message: "That change collides with another booking in the same room.",
        alternatives: await suggestAlternatives(input, id),
      };
    }
    console.error("updateReservation failed", err);
    return { ok: false, kind: "error", message: "Could not update the reservation." };
  }
}

/** Drag-to-move on the tape chart: change room and/or dates only. */
export async function moveReservation(
  id: string,
  roomId: string,
  checkIn: string,
  checkOut: string,
  actorId: string | null
): Promise<MutationResult> {
  if (!(checkOut > checkIn)) {
    return { ok: false, kind: "error", message: "Invalid dates." };
  }
  try {
    await prisma.reservation.update({
      where: { id },
      data: { roomId, checkIn: toDate(checkIn), checkOut: toDate(checkOut) },
    });
    await logAudit({
      userId: actorId,
      action: "reservation.move",
      entityType: "Reservation",
      entityId: id,
      details: { roomId, checkIn, checkOut },
    });
    return { ok: true, id };
  } catch (err) {
    if (isOverlapConstraintError(err)) {
      return {
        ok: false,
        kind: "conflict",
        message: "That slot conflicts with another booking.",
        alternatives: [],
      };
    }
    console.error("moveReservation failed", err);
    return { ok: false, kind: "error", message: "Could not move the reservation." };
  }
}

export async function cancelReservation(id: string, actorId: string | null) {
  await prisma.reservation.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  await logAudit({
    userId: actorId,
    action: "reservation.cancel",
    entityType: "Reservation",
    entityId: id,
  });
}

export async function checkInReservation(
  id: string,
  actorId: string | null,
  data?: { actualGuests?: number; paymentStatus?: "PAID" | "PAY_AT_CHECKOUT" | "OTA_PREPAID" }
) {
  await prisma.reservation.update({
    where: { id },
    data: {
      status: "CHECKED_IN",
      checkedInAt: new Date(),
      ...(data?.actualGuests ? { adults: data.actualGuests } : {}),
      ...(data?.paymentStatus ? { paymentStatus: data.paymentStatus } : {}),
    },
  });
  await logAudit({
    userId: actorId,
    action: "reservation.checkin",
    entityType: "Reservation",
    entityId: id,
  });
}

/** Check-out: close the stay and flag the room dirty for housekeeping (R4). */
export async function checkOutReservation(id: string, actorId: string | null) {
  const res = await prisma.reservation.findUnique({ where: { id } });
  if (!res) return;
  await prisma.$transaction([
    prisma.reservation.update({
      where: { id },
      data: { status: "CHECKED_OUT", checkedOutAt: new Date() },
    }),
    prisma.room.update({
      where: { id: res.roomId },
      data: { housekeepingStatus: "DIRTY" },
    }),
  ]);
  await logAudit({
    userId: actorId,
    action: "reservation.checkout",
    entityType: "Reservation",
    entityId: id,
    details: { roomId: res.roomId },
  });
}

export async function markNoShow(id: string, actorId: string | null) {
  await prisma.reservation.update({ where: { id }, data: { status: "NO_SHOW" } });
  await logAudit({
    userId: actorId,
    action: "reservation.noshow",
    entityType: "Reservation",
    entityId: id,
  });
}

export { toDateStr };
