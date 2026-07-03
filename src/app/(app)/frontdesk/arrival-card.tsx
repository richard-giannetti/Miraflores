"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkInAction } from "./actions";
import { titleCase } from "@/lib/format";

export function ArrivalCard({
  id,
  guestName,
  roomNumber,
  adults,
  children,
  paymentStatus,
  preChecked,
  arrivalTime,
}: {
  id: string;
  guestName: string;
  roomNumber: string;
  adults: number;
  children: number;
  paymentStatus: string;
  preChecked: boolean;
  arrivalTime: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [guests, setGuests] = useState(adults + children);
  const [payment, setPayment] = useState(paymentStatus);
  const [pending, start] = useTransition();

  function confirm() {
    start(async () => {
      await checkInAction(id, {
        actualGuests: guests,
        paymentStatus: payment as "PAID" | "PAY_AT_CHECKOUT" | "OTA_PREPAID",
      });
      router.refresh();
    });
  }

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">
            {guestName}{" "}
            {preChecked && <span className="chip bg-brand-100 text-brand-700">Pre-checked-in</span>}
          </p>
          <p className="text-xs text-slate-500">
            Room {roomNumber} · {adults + children} guest{adults + children > 1 ? "s" : ""}
            {arrivalTime ? ` · arriving ${arrivalTime}` : ""} · {titleCase(paymentStatus)}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setOpen((o) => !o)}>Check in</button>
      </div>
      {open && (
        <div className="mt-3 grid gap-3 rounded-md bg-slate-50 p-3 sm:grid-cols-3">
          <div>
            <label className="label">Actual guests</label>
            <input type="number" min={1} value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="input" />
          </div>
          <div>
            <label className="label">Payment</label>
            <select value={payment} onChange={(e) => setPayment(e.target.value)} className="input">
              <option value="PAY_AT_CHECKOUT">Pay at checkout</option>
              <option value="PAID">Paid</option>
              <option value="OTA_PREPAID">OTA prepaid</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full" disabled={pending} onClick={confirm}>
              {pending ? "…" : "Confirm check-in"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
