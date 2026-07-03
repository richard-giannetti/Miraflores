import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toDateStr } from "@/lib/dates";
import { money, prettyDate, RESERVATION_STATUS_STYLE, SOURCE_LABEL, titleCase } from "@/lib/format";
import type { Prisma, ReservationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUSES: ReservationStatus[] = ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"];

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireAccess("reservations");
  const sp = await searchParams;

  const where: Prisma.ReservationWhereInput = {};
  if (sp.status && STATUSES.includes(sp.status as ReservationStatus)) {
    where.status = sp.status as ReservationStatus;
  }
  if (sp.q) {
    where.OR = [
      { guestName: { contains: sp.q, mode: "insensitive" } },
      { guestEmail: { contains: sp.q, mode: "insensitive" } },
    ];
  }

  const reservations = await prisma.reservation.findMany({
    where,
    include: { room: true },
    orderBy: [{ checkIn: "desc" }],
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Reservations</h1>
        <Link href="/reservations/new" className="btn-primary">+ New reservation</Link>
      </div>

      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Search guest…" className="input max-w-xs" />
        <select name="status" defaultValue={sp.status ?? ""} className="input max-w-[12rem]">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </select>
        <button className="btn-secondary" type="submit">Filter</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Guest</th>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reservations.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No reservations found.</td></tr>
            )}
            {reservations.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{r.guestName}</td>
                <td className="px-4 py-3">{r.room.number}</td>
                <td className="px-4 py-3 text-slate-500">{prettyDate(toDateStr(r.checkIn))} → {prettyDate(toDateStr(r.checkOut))}</td>
                <td className="px-4 py-3 text-slate-500">{SOURCE_LABEL[r.source]}</td>
                <td className="px-4 py-3">{money(Number(r.ratePerNight))}</td>
                <td className="px-4 py-3"><span className={`chip ${RESERVATION_STATUS_STYLE[r.status]}`}>{titleCase(r.status)}</span></td>
                <td className="px-4 py-3 text-right"><Link href={`/reservations/${r.id}`} className="text-brand-600 hover:underline">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
