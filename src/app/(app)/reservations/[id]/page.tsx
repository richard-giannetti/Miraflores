import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toDateStr } from "@/lib/dates";
import { RESERVATION_STATUS_STYLE, titleCase } from "@/lib/format";
import { ReservationForm } from "../reservation-form";
import { DetailActions } from "./detail-actions";

export const dynamic = "force-dynamic";

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAccess("reservations");
  const { id } = await params;

  const r = await prisma.reservation.findUnique({
    where: { id },
    include: {
      room: true,
      createdBy: true,
      checkInToken: true,
      guestCheckIn: true,
    },
  });
  if (!r) notFound();

  const audit = await prisma.auditLog.findMany({
    where: { entityType: "Reservation", entityId: id },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const editable = r.status === "CONFIRMED" || r.status === "CHECKED_IN";
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const existingLink = r.checkInToken ? `${base}/checkin/${r.checkInToken.token}` : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/reservations" className="text-sm text-brand-600 hover:underline">← Reservations</Link>
        <span className={`chip ${RESERVATION_STATUS_STYLE[r.status]}`}>{titleCase(r.status)}</span>
      </div>
      <h1 className="text-2xl font-bold">{r.guestName} · Room {r.room.number}</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {editable ? (
            <ReservationForm
              mode="edit"
              initial={{
                id: r.id,
                guestName: r.guestName,
                guestEmail: r.guestEmail ?? "",
                guestPhone: r.guestPhone ?? "",
                checkIn: toDateStr(r.checkIn),
                checkOut: toDateStr(r.checkOut),
                adults: r.adults,
                children: r.children,
                roomId: r.roomId,
                ratePerNight: Number(r.ratePerNight),
                source: r.source,
                paymentStatus: r.paymentStatus,
                notes: r.notes ?? "",
                roomNumber: r.room.number,
              }}
            />
          ) : (
            <div className="card p-5 text-sm text-slate-500">
              This reservation is {titleCase(r.status).toLowerCase()} and can no longer be edited.
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="card p-5">
            <DetailActions
              id={r.id}
              status={r.status}
              hasEmail={Boolean(r.guestEmail)}
              existingLink={existingLink}
            />
          </div>

          <div className="card p-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Online check-in</h3>
            {r.guestCheckIn?.signedAt ? (
              <div className="space-y-1 text-sm">
                <p className="chip bg-brand-100 text-brand-700">Pre-checked-in</p>
                <p className="text-slate-600">Arrival: {r.guestCheckIn.arrivalTime || "—"}</p>
                <p className="text-slate-600">Guests: {r.guestCheckIn.actualGuests ?? "—"}</p>
                <p className="text-slate-600">Signed by {r.guestCheckIn.signatureName}</p>
                <p className="text-slate-600">ID: {r.guestCheckIn.idImagePath ? (r.guestCheckIn.idImagePurgedAt ? "purged" : "on file (encrypted)") : "not provided"}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Not completed yet.</p>
            )}
          </div>

          <div className="card p-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">History</h3>
            <ul className="space-y-1 text-xs text-slate-500">
              <li>Created by {r.createdBy?.name ?? "—"} · {r.createdAt.toLocaleString("en-GB")}</li>
              {audit.map((a) => (
                <li key={a.id}>{a.action.replace("reservation.", "")} · {a.user?.name ?? "system"} · {a.createdAt.toLocaleString("en-GB")}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
