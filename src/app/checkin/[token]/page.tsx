import { resolveToken } from "@/lib/tokens";
import { toDateStr } from "@/lib/dates";
import { prettyDate } from "@/lib/format";
import { CheckInForm } from "./checkin-form";

export const dynamic = "force-dynamic";

const HOTEL_CONTACT = {
  name: "Casa Miraflores",
  phone: "+34 900 000 000",
  email: "stay@casamiraflores.test",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-start justify-center bg-brand-50 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-brand-700">Casa Miraflores</h1>
          <p className="text-sm text-slate-500">Online check-in</p>
        </div>
        <div className="card p-6">{children}</div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Need help? {HOTEL_CONTACT.phone} · {HOTEL_CONTACT.email}
        </p>
      </div>
    </main>
  );
}

export default async function GuestCheckInPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await resolveToken(token);

  if (!resolved.ok) {
    const messages: Record<string, string> = {
      not_found: "We couldn't find this check-in link.",
      expired: "This check-in link has expired.",
      cancelled: "This reservation is no longer active.",
    };
    return (
      <Shell>
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700">{messages[resolved.reason]}</p>
          <p className="mt-2 text-sm text-slate-500">
            Please contact us and we&apos;ll be glad to help with your check-in.
          </p>
          <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
            <p className="font-medium">{HOTEL_CONTACT.name}</p>
            <p>{HOTEL_CONTACT.phone}</p>
            <p>{HOTEL_CONTACT.email}</p>
          </div>
        </div>
      </Shell>
    );
  }

  const r = resolved.reservation;

  if (r.alreadyCompleted) {
    return (
      <Shell>
        <div className="text-center">
          <p className="text-lg font-semibold text-green-700">You&apos;ve already checked in ✓</p>
          <p className="mt-2 text-sm text-slate-500">
            We have your details, {r.guestName.split(" ")[0]}. See you soon! Please bring your ID to the front desk on arrival.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-5 rounded-md bg-brand-50 p-4 text-sm">
        <p className="font-semibold text-brand-700">Welcome, {r.guestName}</p>
        <p className="text-slate-600">
          Room {r.roomNumber} ({r.roomType}) · {prettyDate(toDateStr(r.checkIn))} → {prettyDate(toDateStr(r.checkOut))}
        </p>
      </div>
      <CheckInForm token={token} defaultGuests={r.adults + r.children} />
    </Shell>
  );
}
