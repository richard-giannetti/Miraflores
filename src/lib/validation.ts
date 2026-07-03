import { z } from "zod";

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a yyyy-MM-dd date");

export const reservationSource = z.enum([
  "WALK_IN",
  "PHONE",
  "EMAIL",
  "BOOKING_COM",
  "EXPEDIA",
  "DIRECT",
  "OTHER",
]);

export const paymentStatus = z.enum(["PAID", "PAY_AT_CHECKOUT", "OTA_PREPAID"]);

const checkoutAfterCheckin = (d: { checkIn: string; checkOut: string }) =>
  d.checkOut > d.checkIn;
const checkoutError = {
  message: "Check-out must be after check-in",
  path: ["checkOut"] as (string | number)[],
};

export const reservationBaseSchema = z.object({
  roomId: z.string().min(1, "Pick a room"),
  guestName: z.string().min(1, "Guest name is required"),
  guestEmail: z.string().email().optional().or(z.literal("")),
  guestPhone: z.string().optional().or(z.literal("")),
  checkIn: dateStr,
  checkOut: dateStr,
  adults: z.coerce.number().int().min(1).max(20),
  children: z.coerce.number().int().min(0).max(20),
  ratePerNight: z.coerce.number().min(0),
  source: reservationSource,
  paymentStatus: paymentStatus,
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export const reservationCreateSchema = reservationBaseSchema.refine(
  checkoutAfterCheckin,
  checkoutError
);

export const reservationUpdateSchema = reservationBaseSchema
  .extend({ id: z.string().min(1) })
  .refine(checkoutAfterCheckin, checkoutError);

export const roomSchema = z.object({
  number: z.string().min(1),
  type: z.string().min(1),
  floor: z.coerce.number().int(),
  maxOccupancy: z.coerce.number().int().min(1).max(20),
  baseRate: z.coerce.number().min(0),
  amenities: z.array(z.string()).default([]),
});

export const guestCheckInSchema = z.object({
  arrivalTime: z.string().max(60).optional().or(z.literal("")),
  actualGuests: z.coerce.number().int().min(1).max(20),
  signatureName: z.string().min(1, "Please type your name to sign"),
});

export type ReservationCreateInput = z.infer<typeof reservationCreateSchema>;
