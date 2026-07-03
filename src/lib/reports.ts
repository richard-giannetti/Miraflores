import { prisma } from "@/lib/prisma";
import { DateStr, datesInRange, nightsInStay } from "@/lib/dates";

/**
 * Owner reports (R8). Hospitality KPIs computed over a [from, to] inclusive
 * date range of nights:
 *   occupancy = roomNightsSold / roomNightsAvailable
 *   ADR       = roomRevenue / roomNightsSold          (Average Daily Rate)
 *   RevPAR    = roomRevenue / roomNightsAvailable      (= ADR x occupancy)
 * A reservation contributes only the nights that fall inside the range.
 * CANCELLED and NO_SHOW reservations are excluded from revenue and occupancy.
 */

export interface ReportResult {
  from: DateStr;
  to: DateStr;
  nightsInRange: number;
  roomCount: number;
  roomNightsAvailable: number;
  roomNightsSold: number;
  occupancy: number; // 0..1
  roomRevenue: number;
  adr: number;
  revpar: number;
  revenueBySource: { source: string; revenue: number; nights: number }[];
}

export async function buildReport(from: DateStr, to: DateStr): Promise<ReportResult> {
  const rangeNights = new Set(
    // nights in [from, to] inclusive == each calendar day from `from` up to `to`
    datesInRange(from, to)
  );
  const nightsInRange = rangeNights.size;

  const roomCount = await prisma.room.count();
  const roomNightsAvailable = roomCount * nightsInRange;

  const reservations = await prisma.reservation.findMany({
    where: {
      status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
      // any stay whose span could touch the range
      checkIn: { lte: new Date(`${to}T00:00:00.000Z`) },
      checkOut: { gt: new Date(`${from}T00:00:00.000Z`) },
    },
    select: {
      ratePerNight: true,
      source: true,
      checkIn: true,
      checkOut: true,
    },
  });

  let roomNightsSold = 0;
  let roomRevenue = 0;
  const bySource = new Map<string, { revenue: number; nights: number }>();

  for (const r of reservations) {
    const ci = r.checkIn.toISOString().slice(0, 10);
    const co = r.checkOut.toISOString().slice(0, 10);
    const rate = Number(r.ratePerNight);
    // Count only the nights of this stay that fall within the report range.
    const soldNights = nightsInStay(ci, co).filter((n) => rangeNights.has(n));
    if (soldNights.length === 0) continue;

    roomNightsSold += soldNights.length;
    const rev = soldNights.length * rate;
    roomRevenue += rev;

    const cur = bySource.get(r.source) ?? { revenue: 0, nights: 0 };
    cur.revenue += rev;
    cur.nights += soldNights.length;
    bySource.set(r.source, cur);
  }

  const occupancy =
    roomNightsAvailable > 0 ? roomNightsSold / roomNightsAvailable : 0;
  const adr = roomNightsSold > 0 ? roomRevenue / roomNightsSold : 0;
  const revpar =
    roomNightsAvailable > 0 ? roomRevenue / roomNightsAvailable : 0;

  return {
    from,
    to,
    nightsInRange,
    roomCount,
    roomNightsAvailable,
    roomNightsSold,
    occupancy,
    roomRevenue,
    adr,
    revpar,
    revenueBySource: [...bySource.entries()]
      .map(([source, v]) => ({ source, revenue: v.revenue, nights: v.nights }))
      .sort((a, b) => b.revenue - a.revenue),
  };
}

export function reportToCsv(r: ReportResult): string {
  const lines: string[] = [];
  lines.push("Metric,Value");
  lines.push(`Date range,${r.from} to ${r.to}`);
  lines.push(`Nights in range,${r.nightsInRange}`);
  lines.push(`Rooms,${r.roomCount}`);
  lines.push(`Room-nights available,${r.roomNightsAvailable}`);
  lines.push(`Room-nights sold,${r.roomNightsSold}`);
  lines.push(`Occupancy,${(r.occupancy * 100).toFixed(1)}%`);
  lines.push(`Room revenue,${r.roomRevenue.toFixed(2)}`);
  lines.push(`ADR,${r.adr.toFixed(2)}`);
  lines.push(`RevPAR,${r.revpar.toFixed(2)}`);
  lines.push("");
  lines.push("Source,Revenue,Room-nights");
  for (const s of r.revenueBySource) {
    lines.push(`${s.source},${s.revenue.toFixed(2)},${s.nights}`);
  }
  return lines.join("\n");
}
