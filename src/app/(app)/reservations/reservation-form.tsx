"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createReservationAction,
  searchRoomsAction,
  updateReservationAction,
  type FormState,
} from "./actions";
import { money, SOURCE_LABEL } from "@/lib/format";

type Room = { id: string; number: string; type: string; maxOccupancy: number; baseRate: number };

export interface ReservationInitial {
  id?: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomId: string;
  ratePerNight: number;
  source: string;
  paymentStatus: string;
  notes: string;
  roomNumber?: string;
}

const SOURCES = ["WALK_IN", "PHONE", "EMAIL", "BOOKING_COM", "EXPEDIA", "DIRECT", "OTHER"];
const PAYMENTS = [
  ["PAY_AT_CHECKOUT", "Pay at checkout"],
  ["PAID", "Paid"],
  ["OTA_PREPAID", "OTA prepaid"],
];

export function ReservationForm({ initial, mode }: { initial?: ReservationInitial; mode: "create" | "edit" }) {
  const router = useRouter();
  const action = mode === "edit" ? updateReservationAction : createReservationAction;
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(action, null);

  const [checkIn, setCheckIn] = useState(initial?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(initial?.checkOut ?? "");
  const [adults, setAdults] = useState(initial?.adults ?? 2);
  const [children, setChildren] = useState(initial?.children ?? 0);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState(initial?.roomId ?? "");
  const [rate, setRate] = useState(initial?.ratePerNight ?? 0);
  const [searching, startSearch] = useTransition();
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (state?.ok && state.id) router.push(`/reservations/${state.id}`);
  }, [state, router]);

  function findRooms() {
    startSearch(async () => {
      const res = await searchRoomsAction({
        checkIn,
        checkOut,
        guests: adults + children,
        ignoreReservationId: initial?.id,
      });
      setRooms(res.rooms);
      setSearched(true);
      // keep current selection if still available, else pick first
      const stillThere = res.rooms.find((r) => r.id === roomId);
      if (!stillThere) {
        const first = res.rooms[0];
        setRoomId(first?.id ?? "");
        if (first) setRate(first.baseRate);
      }
    });
  }

  const err = (f: string) => state?.fieldErrors?.[f];
  const nights = checkIn && checkOut && checkOut > checkIn
    ? Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86400000)
    : 0;

  // Rooms shown in the select: the search results, plus (in edit mode) the
  // currently-assigned room even if not re-searched.
  const roomOptions: Room[] = [...rooms];
  if (initial && !roomOptions.find((r) => r.id === initial.roomId)) {
    roomOptions.unshift({
      id: initial.roomId,
      number: initial.roomNumber ?? "current",
      type: "current",
      maxOccupancy: adults + children,
      baseRate: initial.ratePerNight,
    });
  }

  return (
    <form action={formAction} className="space-y-6">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="roomId" value={roomId} />

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Stay</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="label">Check-in</label>
            <input type="date" name="checkIn" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required className="input" />
            {err("checkIn") && <p className="mt-1 text-xs text-red-600">{err("checkIn")}</p>}
          </div>
          <div>
            <label className="label">Check-out</label>
            <input type="date" name="checkOut" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required className="input" />
            {err("checkOut") && <p className="mt-1 text-xs text-red-600">{err("checkOut")}</p>}
          </div>
          <div>
            <label className="label">Adults</label>
            <input type="number" name="adults" min={1} max={20} value={adults} onChange={(e) => setAdults(Number(e.target.value))} required className="input" />
          </div>
          <div>
            <label className="label">Children</label>
            <input type="number" name="children" min={0} max={20} value={children} onChange={(e) => setChildren(Number(e.target.value))} required className="input" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={findRooms} disabled={!checkIn || !checkOut || searching} className="btn-secondary">
            {searching ? "Searching…" : "Find available rooms"}
          </button>
          {nights > 0 && <span className="text-sm text-slate-500">{nights} night{nights > 1 ? "s" : ""}</span>}
        </div>
        {searched && rooms.length === 0 && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            No rooms are free for those dates and occupancy. Try different dates.
          </p>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Room &amp; rate</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Room</label>
            <select
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value);
                const r = roomOptions.find((x) => x.id === e.target.value);
                if (r) setRate(r.baseRate);
              }}
              className="input"
              required
            >
              <option value="">Select…</option>
              {roomOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.number} · {r.type} · sleeps {r.maxOccupancy}
                </option>
              ))}
            </select>
            {err("roomId") && <p className="mt-1 text-xs text-red-600">{err("roomId")}</p>}
          </div>
          <div>
            <label className="label">Rate / night (€)</label>
            <input type="number" name="ratePerNight" step="0.01" min={0} value={rate} onChange={(e) => setRate(Number(e.target.value))} required className="input" />
          </div>
          <div className="flex items-end">
            <p className="text-sm text-slate-500">Total: <span className="font-semibold text-slate-800">{money(rate * (nights || 0))}</span></p>
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Guest &amp; booking</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Guest name</label>
            <input name="guestName" defaultValue={initial?.guestName} required className="input" />
            {err("guestName") && <p className="mt-1 text-xs text-red-600">{err("guestName")}</p>}
          </div>
          <div>
            <label className="label">Email</label>
            <input name="guestEmail" type="email" defaultValue={initial?.guestEmail} className="input" placeholder="for the check-in link" />
            {err("guestEmail") && <p className="mt-1 text-xs text-red-600">{err("guestEmail")}</p>}
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="guestPhone" defaultValue={initial?.guestPhone} className="input" />
          </div>
          <div>
            <label className="label">Source</label>
            <select name="source" defaultValue={initial?.source ?? "WALK_IN"} className="input">
              {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Payment status</label>
            <select name="paymentStatus" defaultValue={initial?.paymentStatus ?? "PAY_AT_CHECKOUT"} className="input">
              {PAYMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea name="notes" defaultValue={initial?.notes} rows={2} className="input" />
          </div>
        </div>
      </section>

      {state?.conflict && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">{state.conflict.message}</p>
          {state.conflict.alternatives.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold uppercase text-red-500">Available alternatives</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {state.conflict.alternatives.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => { setRoomId(a.id); setRate(a.baseRate); if (!rooms.find(r=>r.id===a.id)) setRooms((p)=>[...p, {...a, maxOccupancy: adults+children}]); }}
                    className="chip bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-100"
                  >
                    Room {a.number} · {money(a.baseRate)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create reservation"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
      </div>
    </form>
  );
}
