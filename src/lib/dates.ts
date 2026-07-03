import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  parseISO,
  startOfDay,
} from "date-fns";

/**
 * All reservation dates are stored as calendar dates (Postgres `date`, no time
 * component). To avoid timezone drift we work with UTC-midnight Date objects and
 * a plain "yyyy-MM-dd" string representation everywhere in the domain.
 */

export type DateStr = string; // "yyyy-MM-dd"

export function toDateStr(d: Date | string): DateStr {
  if (typeof d === "string") return d.slice(0, 10);
  return format(d, "yyyy-MM-dd");
}

/** Parse a "yyyy-MM-dd" into a UTC-midnight Date. */
export function fromDateStr(s: DateStr): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export function today(): DateStr {
  return toDateStr(new Date());
}

export function addDaysStr(s: DateStr, n: number): DateStr {
  return toDateStr(addDays(fromDateStr(s), n));
}

/** Number of nights between two check dates (checkOut exclusive). */
export function nights(checkIn: DateStr, checkOut: DateStr): number {
  return differenceInCalendarDays(fromDateStr(checkOut), fromDateStr(checkIn));
}

/**
 * Half-open overlap test on date strings: do [aIn, aOut) and [bIn, bOut) share
 * at least one night? Back-to-back ranges (aOut === bIn) do NOT overlap.
 */
export function rangesOverlap(
  aIn: DateStr,
  aOut: DateStr,
  bIn: DateStr,
  bOut: DateStr
): boolean {
  return aIn < bOut && bIn < aOut;
}

/** List of the calendar dates covered by [start, end] inclusive. */
export function datesInRange(start: DateStr, end: DateStr): DateStr[] {
  return eachDayOfInterval({
    start: fromDateStr(start),
    end: fromDateStr(end),
  }).map(toDateStr);
}

/** The nights ([checkIn, checkOut) exclusive) a stay occupies. */
export function nightsInStay(checkIn: DateStr, checkOut: DateStr): DateStr[] {
  const out: DateStr[] = [];
  let cur = checkIn;
  while (cur < checkOut) {
    out.push(cur);
    cur = addDaysStr(cur, 1);
  }
  return out;
}

export { startOfDay, parseISO, format };
