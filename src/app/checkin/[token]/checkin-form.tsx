"use client";

import { useActionState } from "react";
import { submitGuestCheckIn, type GuestCheckInState } from "./actions";

export function CheckInForm({
  token,
  defaultGuests,
}: {
  token: string;
  defaultGuests: number;
}) {
  const [state, action, pending] = useActionState<GuestCheckInState | null, FormData>(
    submitGuestCheckIn,
    null
  );
  const fe = (f: string) => state?.fieldErrors?.[f];

  if (state?.ok) {
    return (
      <div className="rounded-lg bg-green-50 p-6 text-center">
        <p className="text-lg font-semibold text-green-700">You&apos;re all set! ✓</p>
        <p className="mt-1 text-sm text-green-600">
          Your online check-in is complete. Please bring your ID to the front desk on arrival to collect your key.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      <div>
        <label className="label">Expected arrival time</label>
        <input name="arrivalTime" className="input" placeholder="e.g. 18:30 or 'late evening'" />
      </div>

      <div>
        <label className="label">Number of guests</label>
        <input name="actualGuests" type="number" min={1} max={20} defaultValue={defaultGuests} required className="input" />
        {fe("actualGuests") && <p className="mt-1 text-xs text-red-600">{fe("actualGuests")}</p>}
      </div>

      <div>
        <label className="label">Photo of your ID / passport (optional)</label>
        <input name="idImage" type="file" accept="image/*,application/pdf" className="input" />
        <p className="mt-1 text-xs text-slate-400">
          Stored encrypted and automatically deleted 30 days after your stay.
        </p>
        {fe("idImage") && <p className="mt-1 text-xs text-red-600">{fe("idImage")}</p>}
      </div>

      <div>
        <label className="label">Digital signature — type your full name</label>
        <input name="signatureName" required className="input" placeholder="Your full name" />
        <p className="mt-1 text-xs text-slate-400">
          By typing your name you confirm the details above are correct and agree to the hotel registration terms.
        </p>
        {fe("signatureName") && <p className="mt-1 text-xs text-red-600">{fe("signatureName")}</p>}
      </div>

      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Submitting…" : "Complete check-in"}
      </button>
    </form>
  );
}
