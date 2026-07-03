import { requireAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toDateStr } from "@/lib/dates";
import { RoomManager, type RoomRow } from "./room-manager";

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  await requireAccess("rooms");

  const rooms = await prisma.room.findMany({
    orderBy: { number: "asc" },
    include: { outOfOrder: { orderBy: { startDate: "asc" } } },
  });

  const rows: RoomRow[] = rooms.map((r) => ({
    id: r.id,
    number: r.number,
    type: r.type,
    floor: r.floor,
    maxOccupancy: r.maxOccupancy,
    baseRate: Number(r.baseRate),
    amenities: r.amenities,
    status: r.status,
    ooo: r.outOfOrder.map((o) => ({
      id: o.id,
      startDate: toDateStr(o.startDate),
      endDate: toDateStr(o.endDate),
      reason: o.reason,
    })),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Rooms &amp; inventory</h1>
      <RoomManager rooms={rows} />
    </div>
  );
}
