import { requireAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReservationForm } from "../reservation-form";

export const dynamic = "force-dynamic";

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ roomId?: string; checkIn?: string; checkOut?: string }>;
}) {
  await requireAccess("reservations");
  const sp = await searchParams;

  // Prefill from a calendar cell click if provided.
  let ratePerNight = 0;
  if (sp.roomId) {
    const room = await prisma.room.findUnique({ where: { id: sp.roomId } });
    ratePerNight = room ? Number(room.baseRate) : 0;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New reservation</h1>
      <ReservationForm
        mode="create"
        initial={
          sp.roomId || sp.checkIn
            ? {
                guestName: "",
                guestEmail: "",
                guestPhone: "",
                checkIn: sp.checkIn ?? "",
                checkOut: sp.checkOut ?? "",
                adults: 2,
                children: 0,
                roomId: sp.roomId ?? "",
                ratePerNight,
                source: "WALK_IN",
                paymentStatus: "PAY_AT_CHECKOUT",
                notes: "",
              }
            : undefined
        }
      />
    </div>
  );
}
