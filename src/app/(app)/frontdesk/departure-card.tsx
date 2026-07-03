"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkOutAction } from "./actions";
import { titleCase } from "@/lib/format";

export function DepartureCard({
  id,
  guestName,
  roomNumber,
  paymentStatus,
}: {
  id: string;
  guestName: string;
  roomNumber: string;
  paymentStatus: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div>
        <p className="font-medium">{guestName}</p>
        <p className="text-xs text-slate-500">Room {roomNumber} · {titleCase(paymentStatus)}</p>
      </div>
      <button
        className="btn-secondary"
        disabled={pending}
        onClick={() => start(async () => { await checkOutAction(id); router.refresh(); })}
      >
        {pending ? "…" : "Check out"}
      </button>
    </li>
  );
}
