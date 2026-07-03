import { requireAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { today } from "@/lib/dates";
import { ArrivalCard } from "./arrival-card";
import { DepartureCard } from "./departure-card";

export const dynamic = "force-dynamic";

export default async function FrontDeskPage() {
  await requireAccess("frontdesk");
  const tD = new Date(`${today()}T00:00:00.000Z`);

  const [arrivals, departures, inHouse] = await Promise.all([
    prisma.reservation.findMany({
      where: { checkIn: tD, status: "CONFIRMED" },
      include: { room: true, guestCheckIn: true },
      orderBy: { room: { number: "asc" } },
    }),
    prisma.reservation.findMany({
      where: { checkOut: tD, status: "CHECKED_IN" },
      include: { room: true },
      orderBy: { room: { number: "asc" } },
    }),
    prisma.reservation.findMany({
      where: { status: "CHECKED_IN", checkOut: { gt: tD } },
      include: { room: true },
      orderBy: { checkOut: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Front desk</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-2 font-semibold">Arrivals today <span className="text-slate-400">({arrivals.length})</span></h2>
          {arrivals.length === 0 ? (
            <p className="text-sm text-slate-400">No arrivals to check in.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {arrivals.map((a) => (
                <ArrivalCard
                  key={a.id}
                  id={a.id}
                  guestName={a.guestName}
                  roomNumber={a.room.number}
                  adults={a.adults}
                  children={a.children}
                  paymentStatus={a.paymentStatus}
                  preChecked={Boolean(a.guestCheckIn?.signedAt)}
                  arrivalTime={a.guestCheckIn?.arrivalTime ?? null}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-2 font-semibold">Departures today <span className="text-slate-400">({departures.length})</span></h2>
          {departures.length === 0 ? (
            <p className="text-sm text-slate-400">No departures.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {departures.map((d) => (
                <DepartureCard key={d.id} id={d.id} guestName={d.guestName} roomNumber={d.room.number} paymentStatus={d.paymentStatus} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card p-5">
        <h2 className="mb-2 font-semibold">In-house <span className="text-slate-400">({inHouse.length})</span></h2>
        {inHouse.length === 0 ? (
          <p className="text-sm text-slate-400">No guests currently in-house.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {inHouse.map((r) => (
              <span key={r.id} className="chip bg-green-100 text-green-700">
                {r.guestName} · Room {r.room.number}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
