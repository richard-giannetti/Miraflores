"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addOutOfOrderAction,
  createRoomAction,
  removeOutOfOrderAction,
  setRoomStatusAction,
  type RoomFormState,
} from "./actions";
import { money, prettyDate } from "@/lib/format";

export interface RoomRow {
  id: string;
  number: string;
  type: string;
  floor: number;
  maxOccupancy: number;
  baseRate: number;
  amenities: string[];
  status: string;
  ooo: { id: string; startDate: string; endDate: string; reason: string }[];
}

export function RoomManager({ rooms }: { rooms: RoomRow[] }) {
  const [state, action, pending] = useActionState<RoomFormState | null, FormData>(createRoomAction, null);
  const fe = (f: string) => state?.fieldErrors?.[f];

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Add a room</h2>
        <form action={action} className="grid gap-3 sm:grid-cols-6">
          <div className="sm:col-span-1">
            <label className="label">Number</label>
            <input name="number" required className="input" placeholder="101" />
            {fe("number") && <p className="text-xs text-red-600">{fe("number")}</p>}
          </div>
          <div className="sm:col-span-1">
            <label className="label">Type</label>
            <input name="type" required className="input" placeholder="double" />
          </div>
          <div className="sm:col-span-1">
            <label className="label">Floor</label>
            <input name="floor" type="number" required className="input" defaultValue={1} />
          </div>
          <div className="sm:col-span-1">
            <label className="label">Sleeps</label>
            <input name="maxOccupancy" type="number" required className="input" defaultValue={2} />
          </div>
          <div className="sm:col-span-1">
            <label className="label">Base rate</label>
            <input name="baseRate" type="number" step="0.01" required className="input" defaultValue={95} />
          </div>
          <div className="sm:col-span-1 flex items-end">
            <button className="btn-primary w-full" disabled={pending}>{pending ? "…" : "Add"}</button>
          </div>
          <div className="sm:col-span-6">
            <label className="label">Amenities (comma-separated)</label>
            <input name="amenities" className="input" placeholder="wifi, ac, balcony" />
          </div>
        </form>
        {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        {rooms.map((r) => <RoomCard key={r.id} room={r} />)}
      </div>
    </div>
  );
}

function RoomCard({ room }: { room: RoomRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showOoo, setShowOoo] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className={`card p-4 ${room.status === "OUT_OF_ORDER" ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-bold">Room {room.number}</p>
          <p className="text-xs text-slate-500">{room.type} · floor {room.floor} · sleeps {room.maxOccupancy} · {money(room.baseRate)}/night</p>
          {room.amenities.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {room.amenities.map((a) => <span key={a} className="chip bg-slate-100 text-slate-500">{a}</span>)}
            </div>
          )}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <span className={room.status === "ACTIVE" ? "text-green-600" : "text-red-500"}>
            {room.status === "ACTIVE" ? "Active" : "Disabled"}
          </span>
          <input
            type="checkbox"
            checked={room.status === "ACTIVE"}
            disabled={pending}
            onChange={(e) => start(async () => { await setRoomStatusAction(room.id, e.target.checked ? "ACTIVE" : "OUT_OF_ORDER"); router.refresh(); })}
          />
        </label>
      </div>

      {room.ooo.length > 0 && (
        <div className="mt-3 space-y-1">
          {room.ooo.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
              <span>Out of order {prettyDate(o.startDate)} → {prettyDate(o.endDate)} · {o.reason}</span>
              <button onClick={() => start(async () => { await removeOutOfOrderAction(o.id); router.refresh(); })} className="text-amber-800 hover:underline">remove</button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3">
        {showOoo ? (
          <div className="space-y-2 rounded bg-slate-50 p-2">
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input text-xs" />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input text-xs" />
            </div>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (e.g. maintenance)" className="input text-xs" />
            {err && <p className="text-xs text-red-600">{err}</p>}
            <div className="flex gap-2">
              <button
                className="btn-primary py-1 text-xs"
                disabled={pending || !startDate || !endDate}
                onClick={() => start(async () => {
                  const res = await addOutOfOrderAction(room.id, startDate, endDate, reason);
                  if (res?.error) { setErr(res.error); return; }
                  setShowOoo(false); setStartDate(""); setEndDate(""); setReason(""); setErr(null); router.refresh();
                })}
              >
                Save block
              </button>
              <button className="btn-secondary py-1 text-xs" onClick={() => setShowOoo(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowOoo(true)} className="text-xs text-brand-600 hover:underline">+ Mark out of order (date range)</button>
        )}
      </div>
    </div>
  );
}
