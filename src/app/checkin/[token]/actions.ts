"use server";

import { prisma } from "@/lib/prisma";
import { resolveToken } from "@/lib/tokens";
import { saveEncryptedId } from "@/lib/idstore";
import { guestCheckInSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

export interface GuestCheckInState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function submitGuestCheckIn(
  _prev: GuestCheckInState | null,
  formData: FormData
): Promise<GuestCheckInState> {
  const token = String(formData.get("token") ?? "");
  const resolved = await resolveToken(token);
  if (!resolved.ok) {
    return { error: "This check-in link is no longer valid. Please contact the hotel." };
  }
  const reservationId = resolved.reservation.id;

  const parsed = guestCheckInSchema.safeParse({
    arrivalTime: formData.get("arrivalTime"),
    actualGuests: formData.get("actualGuests"),
    signatureName: formData.get("signatureName"),
  });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[i.path.join(".")] = i.message;
    return { fieldErrors: fe };
  }

  // Optional encrypted ID upload.
  let idImagePath: string | undefined;
  const file = formData.get("idImage");
  if (file instanceof File && file.size > 0) {
    if (file.size > 8 * 1024 * 1024) {
      return { fieldErrors: { idImage: "File too large (max 8 MB)." } };
    }
    const buf = Buffer.from(await file.arrayBuffer());
    idImagePath = await saveEncryptedId(reservationId, buf, file.type || "application/octet-stream");
  }

  await prisma.guestCheckIn.upsert({
    where: { reservationId },
    create: {
      reservationId,
      arrivalTime: parsed.data.arrivalTime || null,
      actualGuests: parsed.data.actualGuests,
      signatureName: parsed.data.signatureName,
      signedAt: new Date(),
      idImagePath,
    },
    update: {
      arrivalTime: parsed.data.arrivalTime || null,
      actualGuests: parsed.data.actualGuests,
      signatureName: parsed.data.signatureName,
      signedAt: new Date(),
      ...(idImagePath ? { idImagePath } : {}),
    },
  });

  await prisma.checkInToken.update({
    where: { reservationId },
    data: { usedAt: new Date() },
  });

  await logAudit({
    action: "guest.checkin",
    entityType: "Reservation",
    entityId: reservationId,
    details: { via: "online" },
  });

  return { ok: true };
}
