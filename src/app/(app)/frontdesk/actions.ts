"use server";

import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { checkInReservation, checkOutReservation } from "@/lib/reservations";

export async function checkInAction(
  id: string,
  data: { actualGuests?: number; paymentStatus?: "PAID" | "PAY_AT_CHECKOUT" | "OTA_PREPAID" }
) {
  const user = await requireAccess("frontdesk");
  await checkInReservation(id, user.id, data);
  revalidatePath("/frontdesk");
  revalidatePath("/");
  revalidatePath("/calendar");
}

export async function checkOutAction(id: string) {
  const user = await requireAccess("frontdesk");
  await checkOutReservation(id, user.id);
  revalidatePath("/frontdesk");
  revalidatePath("/housekeeping");
  revalidatePath("/");
  revalidatePath("/calendar");
}
