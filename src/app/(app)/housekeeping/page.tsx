import { requireAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { today } from "@/lib/dates";
import { HousekeepingBoard, type BoardRoom } from "./board";

export const dynamic = "force-dynamic";

export default async function HousekeepingPage() {
  await requireAccess("housekeeping");
  const tD = new Date(`${today()}T00:00:00.000Z`);

  const rooms = await prisma.room.findMany({
    where: { status: "ACTIVE" },
    orderBy: { number: "asc" },
    include: {
      reservations: {
        where: {
          status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
          OR: [{ checkIn: tD }, { checkOut: tD }],
        },
        select: { checkIn: true, checkOut: true },
      },
    },
  });

  const boardRooms: BoardRoom[] = rooms.map((r) => {
    const arrivalToday = r.reservations.some((res) => res.checkIn.getTime() === tD.getTime());
    const departureToday = r.reservations.some((res) => res.checkOut.getTime() === tD.getTime());
    return {
      id: r.id,
      number: r.number,
      type: r.type,
      floor: r.floor,
      status: r.housekeepingStatus,
      note: r.housekeepingNote,
      departureToday,
      arrivalToday,
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Housekeeping</h1>
        <p className="text-sm text-slate-500">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · updates every 20s
        </p>
      </div>
      <HousekeepingBoard rooms={boardRooms} />
    </div>
  );
}
