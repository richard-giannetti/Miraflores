import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Guest online check-in tokens (R5). Opaque, high-entropy, single-property
 * secrets stored hashed-by-uniqueness (the raw token is the lookup key and is
 * only ever sent to the guest by email). No guest account is created.
 */

const TOKEN_TTL_DAYS = 30;

export function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Create (or replace) the check-in token for a reservation. Returns the link. */
export async function issueCheckInToken(reservationId: string): Promise<{
  token: string;
  url: string;
  expiresAt: Date;
}> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 3600 * 1000);

  await prisma.checkInToken.upsert({
    where: { reservationId },
    create: { reservationId, token, expiresAt },
    update: { token, expiresAt, usedAt: null },
  });

  const base = process.env.APP_URL ?? "http://localhost:3000";
  return { token, url: `${base}/checkin/${token}`, expiresAt };
}

export type TokenState =
  | { ok: true; reservation: TokenReservation }
  | { ok: false; reason: "not_found" | "expired" | "cancelled" };

export interface TokenReservation {
  id: string;
  guestName: string;
  guestEmail: string | null;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  roomNumber: string;
  roomType: string;
  status: string;
  alreadyCompleted: boolean;
}

/** Resolve a raw token to a reservation, validating expiry and status. */
export async function resolveToken(token: string): Promise<TokenState> {
  const record = await prisma.checkInToken.findUnique({
    where: { token },
    include: {
      reservation: {
        include: { room: true, guestCheckIn: true },
      },
    },
  });

  if (!record) return { ok: false, reason: "not_found" };
  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  const r = record.reservation;
  if (r.status === "CANCELLED" || r.status === "NO_SHOW") {
    return { ok: false, reason: "cancelled" };
  }

  return {
    ok: true,
    reservation: {
      id: r.id,
      guestName: r.guestName,
      guestEmail: r.guestEmail,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      adults: r.adults,
      children: r.children,
      roomNumber: r.room.number,
      roomType: r.room.type,
      status: r.status,
      alreadyCompleted: Boolean(r.guestCheckIn?.signedAt),
    },
  };
}
