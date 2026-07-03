"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveReservationAction } from "./actions";

interface Room { id: string; number: string; type: string }
interface Booking {
  id: string;
  roomId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  nights: number;
}
interface Ooo { roomId: string; startDate: string; endDate: string; reason: string }

const BAR_COLOR: Record<string, string> = {
  CONFIRMED: "bg-blue-500 hover:bg-blue-600",
  CHECKED_IN: "bg-green-600 hover:bg-green-700",
  CHECKED_OUT: "bg-slate-400 hover:bg-slate-500",
};

function diffDays(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000
  );
}
function nextDay(d: string): string {
  const dt = new Date(`${d}T00:00:00.000Z`);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

export function TapeChart({
  rooms,
  bookings,
  ooo,
  days,
}: {
  rooms: Room[];
  bookings: Booking[];
  ooo: Ooo[];
  days: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const windowStart = days[0];
  const nDays = days.length;
  const clamp = (n: number) => Math.max(0, Math.min(nDays, n));

  // Grid columns: track 1 = room label, tracks 2..(nDays+1) = the days.
  // A [start, end) range maps to grid-column `${2 + startOffset} / ${2 + endOffset}`.
  function span(startDate: string, endDate: string): { col: string } | null {
    const s = clamp(diffDays(windowStart, startDate));
    const e = clamp(diffDays(windowStart, endDate));
    if (e <= s) return null; // entirely outside the visible window
    return { col: `${2 + s} / ${2 + e}` };
  }

  function onDrop(roomId: string, day: string) {
    if (!dragId) return;
    const b = bookings.find((x) => x.id === dragId);
    setDragId(null);
    if (!b) return;
    start(async () => {
      const res = await moveReservationAction(b.id, roomId, day, b.nights);
      if (!res.ok) {
        setToast(res.message ?? "Move rejected.");
        setTimeout(() => setToast(null), 4000);
      } else {
        router.refresh();
      }
    });
  }

  const gridTemplate = `72px repeat(${nDays}, minmax(44px, 1fr))`;
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="relative">
      {toast && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-md bg-red-600 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <div style={{ minWidth: `${72 + nDays * 44}px` }}>
          {/* Header */}
          <div className="grid border-b border-slate-200 bg-slate-50" style={{ gridTemplateColumns: gridTemplate }}>
            <div className="p-2 text-xs font-semibold text-slate-500">Room</div>
            {days.map((d) => {
              const dt = new Date(`${d}T00:00:00.000Z`);
              return (
                <div key={d} className={`border-l border-slate-100 p-1 text-center text-[10px] ${d === todayStr ? "bg-brand-50 font-bold text-brand-700" : "text-slate-500"}`}>
                  <div>{dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}</div>
                  <div className="text-sm">{dt.getUTCDate()}</div>
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {rooms.map((room) => {
            const roomBookings = bookings.filter((b) => b.roomId === room.id);
            const roomOoo = ooo.filter((o) => o.roomId === room.id);
            return (
              <div key={room.id} className="grid border-b border-slate-100" style={{ gridTemplateColumns: gridTemplate, height: "44px" }}>
                <div className="flex flex-col justify-center p-2">
                  <span className="text-sm font-semibold">{room.number}</span>
                  <span className="text-[10px] text-slate-400">{room.type}</span>
                </div>

                {/* Droppable, clickable day cells */}
                {days.map((d) => (
                  <div
                    key={d}
                    style={{ gridRow: 1 }}
                    onDragOver={(e) => { if (dragId) e.preventDefault(); }}
                    onDrop={() => onDrop(room.id, d)}
                    onClick={() => router.push(`/reservations/new?roomId=${room.id}&checkIn=${d}&checkOut=${nextDay(d)}`)}
                    className={`cursor-pointer border-l border-slate-100 hover:bg-brand-50/40 ${d === todayStr ? "bg-brand-50/30" : ""}`}
                  />
                ))}

                {/* Out-of-order blocks */}
                {roomOoo.map((o, i) => {
                  const pos = span(o.startDate, o.endDate);
                  if (!pos) return null;
                  return (
                    <div
                      key={`ooo-${i}`}
                      title={`Out of order: ${o.reason}`}
                      className="pointer-events-none z-0 m-1 flex items-center justify-center rounded bg-[repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0_6px,#f8fafc_6px,#f8fafc_12px)] text-[10px] text-slate-500"
                      style={{ gridColumn: pos.col, gridRow: 1 }}
                    >
                      Out of order
                    </div>
                  );
                })}

                {/* Reservation bars */}
                {roomBookings.map((b) => {
                  const pos = span(b.checkIn, b.checkOut);
                  if (!pos) return null;
                  const draggable = b.status === "CONFIRMED" || b.status === "CHECKED_IN";
                  return (
                    <div
                      key={b.id}
                      draggable={draggable}
                      onDragStart={() => setDragId(b.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={(e) => { e.stopPropagation(); router.push(`/reservations/${b.id}`); }}
                      title={`${b.guestName} · ${b.checkIn} → ${b.checkOut}`}
                      className={`z-10 m-1 flex items-center overflow-hidden truncate rounded px-2 text-xs font-medium text-white ${BAR_COLOR[b.status] ?? "bg-slate-400"} ${draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer opacity-80"}`}
                      style={{ gridColumn: pos.col, gridRow: 1 }}
                    >
                      {b.guestName}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      {pending && <p className="mt-2 text-xs text-slate-400">Saving…</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <Legend className="bg-blue-500" label="Confirmed" />
        <Legend className="bg-green-600" label="Checked-in" />
        <Legend className="bg-slate-400" label="Checked-out" />
        <span className="text-slate-400">Drag a bar to move · click a bar to open · click an empty cell to book</span>
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-3 w-3 rounded ${className}`} /> {label}
    </span>
  );
}
