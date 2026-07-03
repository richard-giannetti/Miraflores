// Client-safe formatting helpers (no server-only imports).

export function money(n: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n);
}

export function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function prettyDate(s: string): string {
  const [y, m, d] = s.split("-");
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const RESERVATION_STATUS_STYLE: Record<string, string> = {
  CONFIRMED: "bg-blue-100 text-blue-700",
  CHECKED_IN: "bg-green-100 text-green-700",
  CHECKED_OUT: "bg-slate-100 text-slate-600",
  CANCELLED: "bg-red-100 text-red-600",
  NO_SHOW: "bg-amber-100 text-amber-700",
};

export const HOUSEKEEPING_STYLE: Record<string, string> = {
  DIRTY: "bg-red-100 text-red-700",
  CLEANING: "bg-amber-100 text-amber-700",
  CLEAN: "bg-green-100 text-green-700",
  INSPECTED: "bg-brand-100 text-brand-700",
};

export const SOURCE_LABEL: Record<string, string> = {
  WALK_IN: "Walk-in",
  PHONE: "Phone",
  EMAIL: "Email",
  BOOKING_COM: "Booking.com",
  EXPEDIA: "Expedia",
  DIRECT: "Direct",
  OTHER: "Other",
};

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
