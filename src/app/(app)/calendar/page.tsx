import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDaysStr, nights, today, toDateStr } from "@/lib/dates";
import { TapeChart } from "./tape-chart";

export const dynamic = "force-dynamic";

const WINDOW = 21; // days visible

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  await requireAccess("calendar");
  const sp = await searchParams;
  const start = sp.start && /^\d{4}-\d{2}-\d{2}$/.test(sp.start) ? sp.start : addDaysStr(today(), -2);
  const endExclusive = addDaysStr(start, WINDOW);

  const days: string[] = [];
  for (let i = 0; i < WINDOW; i++) days.push(addDaysStr(start, i));

  const startD = new Date(`${start}T00:00:00.000Z`);
  const endD = new Date(`${endExclusive}T00:00:00.000Z`);

  const [rooms, reservations, ooo] = await Promise.all([
    prisma.room.findMany({ orderBy: { number: "asc" } }),
    prisma.reservation.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
        checkIn: { lt: endD },
        checkOut: { gt: startD },
      },
      include: { room: true },
    }),
    prisma.roomOutOfOrder.findMany({
      where: { startDate: { lt: endD }, endDate: { gt: startD } },
    }),
  ]);

  const bookings = reservations.map((r) => {
    const ci = toDateStr(r.checkIn);
    const co = toDateStr(r.checkOut);
    return {
      id: r.id,
      roomId: r.roomId,
      guestName: r.guestName,
      checkIn: ci,
      checkOut: co,
      status: r.status,
      nights: nights(ci, co),
    };
  });

  const oooBlocks = ooo.map((o) => ({
    roomId: o.roomId,
    startDate: toDateStr(o.startDate),
    endDate: toDateStr(o.endDate),
    reason: o.reason,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-2">
          <Link href={`/calendar?start=${addDaysStr(start, -WINDOW)}`} className="btn-secondary">← Earlier</Link>
          <Link href={`/calendar?start=${addDaysStr(today(), -2)}`} className="btn-secondary">Today</Link>
          <Link href={`/calendar?start=${addDaysStr(start, WINDOW)}`} className="btn-secondary">Later →</Link>
          <Link href="/reservations/new" className="btn-primary">+ New</Link>
        </div>
      </div>
      <TapeChart rooms={rooms} bookings={bookings} ooo={oooBlocks} days={days} />
    </div>
  );
}
