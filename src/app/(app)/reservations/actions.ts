"use server";

import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import {
  reservationCreateSchema,
  reservationUpdateSchema,
} from "@/lib/validation";
import {
  cancelReservation,
  createReservation,
  markNoShow,
  updateReservation,
  type MutationResult,
} from "@/lib/reservations";
import { findAvailableRooms } from "@/lib/availability";
import { issueCheckInToken } from "@/lib/tokens";

export interface FormState {
  ok?: boolean;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  conflict?: { message: string; alternatives: { id: string; number: string; type: string; baseRate: number }[] };
}

function zodToFieldErrors(err: import("zod").ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function searchRoomsAction(input: {
  checkIn: string;
  checkOut: string;
  guests: number;
  ignoreReservationId?: string;
}) {
  await requireAccess("reservations");
  if (!input.checkIn || !input.checkOut || !(input.checkOut > input.checkIn)) {
    return { rooms: [] as Awaited<ReturnType<typeof findAvailableRooms>> };
  }
  const rooms = await findAvailableRooms({
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    minOccupancy: input.guests || 1,
    ignoreReservationId: input.ignoreReservationId,
  });
  return { rooms };
}

function mapResult(result: MutationResult): FormState {
  if (result.ok) return { ok: true, id: result.id };
  if (result.kind === "conflict") {
    return { conflict: { message: result.message, alternatives: result.alternatives } };
  }
  return { error: result.message };
}

export async function createReservationAction(
  _prev: FormState | null,
  formData: FormData
): Promise<FormState> {
  const user = await requireAccess("reservations");
  const parsed = reservationCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: zodToFieldErrors(parsed.error) };
  }
  const result = await createReservation(parsed.data, user.id);
  if (result.ok) revalidatePath("/reservations");
  return mapResult(result);
}

export async function updateReservationAction(
  _prev: FormState | null,
  formData: FormData
): Promise<FormState> {
  const user = await requireAccess("reservations");
  const parsed = reservationUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: zodToFieldErrors(parsed.error) };
  }
  const { id, ...data } = parsed.data;
  const result = await updateReservation(id, data, user.id);
  if (result.ok) {
    revalidatePath("/reservations");
    revalidatePath(`/reservations/${id}`);
  }
  return mapResult(result);
}

export async function cancelReservationAction(id: string) {
  const user = await requireAccess("reservations");
  await cancelReservation(id, user.id);
  revalidatePath("/reservations");
  revalidatePath("/calendar");
}

export async function noShowAction(id: string) {
  const user = await requireAccess("reservations");
  await markNoShow(id, user.id);
  revalidatePath("/reservations");
}

export async function issueCheckInLinkAction(id: string) {
  await requireAccess("reservations");
  const { url } = await issueCheckInToken(id);
  revalidatePath(`/reservations/${id}`);
  return { url };
}
