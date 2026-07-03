"use server";

import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { moveReservation } from "@/lib/reservations";
import { addDaysStr, nights } from "@/lib/dates";

export interface MoveResult {
  ok: boolean;
  message?: string;
}

/**
 * Drag-to-move on the tape chart: drop a reservation on a new (room, day). The
 * stay keeps its length; checkIn becomes the drop day. The DB exclusion
 * constraint is the backstop — a conflicting drop is rejected here with a reason
 * (R3 AC).
 */
export async function moveReservationAction(
  id: string,
  toRoomId: string,
  newCheckIn: string,
  lengthNights: number
): Promise<MoveResult> {
  const user = await requireAccess("calendar");
  const len = Math.max(1, lengthNights);
  const newCheckOut = addDaysStr(newCheckIn, len);

  const result = await moveReservation(id, toRoomId, newCheckIn, newCheckOut, user.id);
  if (result.ok) {
    revalidatePath("/calendar");
    return { ok: true };
  }
  return {
    ok: false,
    message: "kind" in result && result.kind === "conflict" ? result.message : "Could not move the reservation.",
  };
}

export { nights };
