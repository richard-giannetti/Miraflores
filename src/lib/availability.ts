import { prisma } from "@/lib/prisma";
import { DateStr, nights, rangesOverlap, toDateStr } from "@/lib/dates";
import { Prisma } from "@prisma/client";

/**
 * Availability & conflict logic — the highest-risk part of the system.
 *
 * The database exclusion constraint (see migration reservation_no_overlap) is
 * the *authoritative* guarantee: it makes a double-booking impossible even under
 * races. These functions provide the *proactive* checks the UI needs — telling
 * staff a room is free before they try, and suggesting alternatives — plus the
 * out-of-order handling that the constraint doesn't cover.
 *
 * The pure predicates below are deliberately free of DB access so they can be
 * unit-tested exhaustively.
 */

// The reservation statuses that actually hold inventory.
export const BLOCKING_STATUSES = ["CONFIRMED", "CHECKED_IN"] as const;

export interface Occupied {
  checkIn: DateStr;
  checkOut: DateStr;
}

export interface OooBlock {
  startDate: DateStr; // inclusive
  endDate: DateStr; // exclusive, same [start, end) semantics as a stay
}

/**
 * Is a room free for the whole requested stay, given its existing bookings and
 * out-of-order blocks? Pure — no I/O.
 */
export function isRoomAvailable(
  checkIn: DateStr,
  checkOut: DateStr,
  bookings: Occupied[],
  ooo: OooBlock[] = []
): boolean {
  if (!(checkOut > checkIn)) return false; // zero/negative-length stays are invalid
  for (const b of bookings) {
    if (rangesOverlap(checkIn, checkOut, b.checkIn, b.checkOut)) return false;
  }
  for (const block of ooo) {
    if (rangesOverlap(checkIn, checkOut, block.startDate, block.endDate)) {
      return false;
    }
  }
  return true;
}

/**
 * Given a proposed stay and the set of bookings that would remain if we ignore
 * one reservation (used when *editing* an existing reservation), decide whether
 * it fits. `ignoreReservationId` lets an edit not conflict with itself.
 */
export function conflictsWith(
  checkIn: DateStr,
  checkOut: DateStr,
  bookings: (Occupied & { id: string })[],
  ignoreReservationId?: string
): boolean {
  return bookings.some(
    (b) =>
      b.id !== ignoreReservationId &&
      rangesOverlap(checkIn, checkOut, b.checkIn, b.checkOut)
  );
}

// ---- DB-backed queries ----------------------------------------------------

export interface AvailableRoom {
  id: string;
  number: string;
  type: string;
  floor: number;
  maxOccupancy: number;
  baseRate: number;
  amenities: string[];
}

/**
 * Rooms that are ACTIVE and free for [checkIn, checkOut), optionally filtered by
 * type and minimum occupancy. Excludes rooms with an overlapping out-of-order
 * block (satisfies R1 AC) and rooms with an overlapping active reservation
 * (optionally ignoring one, for edits).
 */
export async function findAvailableRooms(params: {
  checkIn: DateStr;
  checkOut: DateStr;
  type?: string;
  minOccupancy?: number;
  ignoreReservationId?: string;
}): Promise<AvailableRoom[]> {
  const { checkIn, checkOut, type, minOccupancy, ignoreReservationId } = params;
  const inD = new Date(`${checkIn}T00:00:00.000Z`);
  const outD = new Date(`${checkOut}T00:00:00.000Z`);

  const rooms = await prisma.room.findMany({
    where: {
      status: "ACTIVE",
      ...(type ? { type } : {}),
      ...(minOccupancy ? { maxOccupancy: { gte: minOccupancy } } : {}),
      // No active reservation overlapping the range.
      reservations: {
        none: {
          status: { in: [...BLOCKING_STATUSES] },
          ...(ignoreReservationId ? { id: { not: ignoreReservationId } } : {}),
          checkIn: { lt: outD },
          checkOut: { gt: inD },
        },
      },
      // No out-of-order block overlapping the range.
      outOfOrder: {
        none: {
          startDate: { lt: outD },
          endDate: { gt: inD },
        },
      },
    },
    orderBy: { number: "asc" },
  });

  return rooms.map((r) => ({
    id: r.id,
    number: r.number,
    type: r.type,
    floor: r.floor,
    maxOccupancy: r.maxOccupancy,
    baseRate: Number(r.baseRate),
    amenities: r.amenities,
  }));
}

/**
 * Is one specific room free? Used by the reservation form and drag-to-move on
 * the tape chart before hitting the DB constraint.
 */
export async function isRoomFree(params: {
  roomId: string;
  checkIn: DateStr;
  checkOut: DateStr;
  ignoreReservationId?: string;
}): Promise<boolean> {
  const { roomId, checkIn, checkOut, ignoreReservationId } = params;
  const inD = new Date(`${checkIn}T00:00:00.000Z`);
  const outD = new Date(`${checkOut}T00:00:00.000Z`);

  const conflict = await prisma.reservation.findFirst({
    where: {
      roomId,
      status: { in: [...BLOCKING_STATUSES] },
      ...(ignoreReservationId ? { id: { not: ignoreReservationId } } : {}),
      checkIn: { lt: outD },
      checkOut: { gt: inD },
    },
    select: { id: true },
  });
  if (conflict) return false;

  const ooo = await prisma.roomOutOfOrder.findFirst({
    where: { roomId, startDate: { lt: outD }, endDate: { gt: inD } },
    select: { id: true },
  });
  return !ooo;
}

/** Postgres exclusion-constraint violations surface with this code. */
export function isOverlapConstraintError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2010 = raw query failed; the underlying pg error 23P01 = exclusion violation.
    const meta = (err.meta ?? {}) as Record<string, unknown>;
    const message = `${err.message} ${JSON.stringify(meta)}`;
    return (
      err.code === "P2010" ||
      message.includes("reservation_no_overlap") ||
      message.includes("23P01")
    );
  }
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message).includes(
      "reservation_no_overlap"
    );
  }
  return false;
}

export { nights, toDateStr };
