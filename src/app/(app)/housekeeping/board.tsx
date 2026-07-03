"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setHousekeepingNote, setHousekeepingStatus } from "./actions";
import { HOUSEKEEPING_STYLE, titleCase } from "@/lib/format";
import type { HousekeepingStatus } from "@prisma/client";

export interface BoardRoom {
  id: string;
  number: string;
  type: string;
  floor: number;
  status: HousekeepingStatus;
  note: string | null;
  departureToday: boolean;
  arrivalToday: boolean;
}

const FLOW: HousekeepingStatus[] = ["DIRTY", "CLEANING", "CLEAN", "INSPECTED"];

function RoomTile({ room }: { room: BoardRoom }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(room.note ?? "");

  const priority = room.departureToday && room.arrivalToday;

  return (
    <div className={`card p-4 ${priority ? "ring-2 ring-amber-300" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-bold">Room {room.number}</p>
          <p className="text-xs text-slate-500">{room.type} · floor {room.floor}</p>
        </div>
        <span className={`chip ${HOUSEKEEPING_STYLE[room.status]}`}>{titleCase(room.status)}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1 text-xs">
        {room.departureToday && <span className="chip bg-red-50 text-red-600">Departure</span>}
        {room.arrivalToday && <span className="chip bg-blue-50 text-blue-600">Arrival</span>}
        {priority && <span className="chip bg-amber-100 text-amber-700">Turnover — priority</span>}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1">
        {FLOW.map((s) => (
          <button
            key={s}
            disabled={pending || s === room.status}
            onClick={() => start(async () => { await setHousekeepingStatus(room.id, s); router.refresh(); })}
            className={`rounded-md px-1 py-2 text-xs font-medium transition ${
              s === room.status
                ? `${HOUSEKEEPING_STYLE[s]} ring-1 ring-inset ring-current`
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {titleCase(s)}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {editingNote ? (
          <div className="flex gap-1">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Maintenance note…" className="input text-xs" />
            <button
              className="btn-secondary px-2 py-1"
              disabled={pending}
              onClick={() => start(async () => { await setHousekeepingNote(room.id, note); setEditingNote(false); router.refresh(); })}
            >
              Save
            </button>
          </div>
        ) : room.note ? (
          <button onClick={() => setEditingNote(true)} className="text-left text-xs text-amber-700">
            🔧 {room.note} <span className="text-slate-400">(edit)</span>
          </button>
        ) : (
          <button onClick={() => setEditingNote(true)} className="text-xs text-slate-400 hover:text-slate-600">+ Add note</button>
        )}
      </div>
    </div>
  );
}

export function HousekeepingBoard({ rooms }: { rooms: BoardRoom[] }) {
  const router = useRouter();

  // Near-live: refresh from the server every 20s so front-desk changes and
  // other housekeepers' updates appear without a manual reload (R6 AC).
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 20000);
    return () => clearInterval(t);
  }, [router]);

  const turnover = rooms.filter((r) => r.departureToday && r.arrivalToday);
  const departures = rooms.filter((r) => r.departureToday && !r.arrivalToday);
  const dirty = rooms.filter((r) => !r.departureToday && r.status !== "CLEAN" && r.status !== "INSPECTED");
  const rest = rooms.filter(
    (r) => !turnover.includes(r) && !departures.includes(r) && !dirty.includes(r)
  );

  const groups = [
    { title: "Turnover — departure & arrival today", rooms: turnover },
    { title: "Departures today", rooms: departures },
    { title: "Needs attention", rooms: dirty },
    { title: "Other rooms", rooms: rest },
  ].filter((g) => g.rooms.length > 0);

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {g.title} <span className="text-slate-400">({g.rooms.length})</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.rooms.map((r) => <RoomTile key={r.id} room={r} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
