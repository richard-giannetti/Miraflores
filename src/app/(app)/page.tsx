import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { today } from "@/lib/dates";
import { money, HOUSEKEEPING_STYLE, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

function dstr(s: string) {
  return new Date(`${s}T00:00:00.000Z`);
}

export default async function DashboardPage() {
  await requireAccess("dashboard");
  const t = today();
  const tD = dstr(t);

  const [arrivals, departures, inHouse, roomCount, notReady, occupiedTonight] =
    await Promise.all([
      // Arrivals today: confirmed reservations starting today
      prisma.reservation.findMany({
        where: { checkIn: tD, status: "CONFIRMED" },
        include: { room: true, guestCheckIn: true },
        orderBy: { room: { number: "asc" } },
      }),
      // Departures today: checked-in stays ending today
      prisma.reservation.findMany({
        where: { checkOut: tD, status: { in: ["CHECKED_IN", "CONFIRMED"] } },
        include: { room: true },
        orderBy: { room: { number: "asc" } },
      }),
      prisma.reservation.count({ where: { status: "CHECKED_IN" } }),
      prisma.room.count({ where: { status: "ACTIVE" } }),
      prisma.room.findMany({
        where: { status: "ACTIVE", housekeepingStatus: { in: ["DIRTY", "CLEANING"] } },
        orderBy: { number: "asc" },
      }),
      // Rooms sold for tonight (stays spanning tonight)
      prisma.reservation.count({
        where: {
          status: { in: ["CONFIRMED", "CHECKED_IN"] },
          checkIn: { lte: tD },
          checkOut: { gt: tD },
        },
      }),
    ]);

  const occupancy = roomCount > 0 ? occupiedTonight / roomCount : 0;

  const stats = [
    { label: "Arrivals today", value: arrivals.length, href: "/frontdesk" },
    { label: "Departures today", value: departures.length, href: "/frontdesk" },
    { label: "In-house guests", value: inHouse, href: "/reservations?status=CHECKED_IN" },
    { label: "Occupancy tonight", value: `${Math.round(occupancy * 100)}%`, sub: `${occupiedTonight}/${roomCount} rooms` },
    { label: "Rooms not ready", value: notReady.length, href: "/housekeeping" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Today at Casa</h1>
          <p className="text-sm text-slate-500">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <Link href="/reservations/new" className="btn-primary">+ New reservation</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{s.label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-800">{s.value}</div>
            {s.sub && <div className="text-xs text-slate-400">{s.sub}</div>}
            {s.href && <Link href={s.href} className="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline">View →</Link>}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Arrivals today</h2>
          {arrivals.length === 0 ? (
            <p className="text-sm text-slate-400">No arrivals scheduled.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {arrivals.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <span className="font-medium">{a.guestName}</span>
                    <span className="text-slate-400"> · Room {a.room.number}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {a.guestCheckIn?.signedAt && (
                      <span className="chip bg-brand-100 text-brand-700">Pre-checked-in</span>
                    )}
                    <Link href="/frontdesk" className="text-brand-600 hover:underline">Check in</Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Departures today</h2>
          {departures.length === 0 ? (
            <p className="text-sm text-slate-400">No departures scheduled.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {departures.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <span className="font-medium">{a.guestName}</span>
                    <span className="text-slate-400"> · Room {a.room.number} · {money(Number(a.ratePerNight))}/night</span>
                  </span>
                  <Link href="/frontdesk" className="text-brand-600 hover:underline">Check out</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {notReady.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Rooms not yet ready</h2>
          <div className="flex flex-wrap gap-2">
            {notReady.map((r) => (
              <span key={r.id} className={`chip ${HOUSEKEEPING_STYLE[r.housekeepingStatus]}`}>
                Room {r.number} · {titleCase(r.housekeepingStatus)}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
