import { describe, expect, it } from "vitest";
import {
  addDaysStr,
  nights,
  nightsInStay,
  rangesOverlap,
  toDateStr,
} from "@/lib/dates";

describe("date helpers", () => {
  it("counts nights as the exclusive checkout difference", () => {
    expect(nights("2026-07-10", "2026-07-12")).toBe(2);
    expect(nights("2026-07-10", "2026-07-11")).toBe(1);
  });

  it("adds days without timezone drift", () => {
    expect(addDaysStr("2026-07-10", 5)).toBe("2026-07-15");
    expect(addDaysStr("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("lists the exact nights a stay occupies", () => {
    expect(nightsInStay("2026-07-10", "2026-07-13")).toEqual([
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
    ]);
  });

  it("half-open overlap: back-to-back does not overlap", () => {
    expect(rangesOverlap("2026-07-10", "2026-07-12", "2026-07-12", "2026-07-14")).toBe(
      false
    );
    expect(rangesOverlap("2026-07-10", "2026-07-12", "2026-07-11", "2026-07-14")).toBe(
      true
    );
  });

  it("normalises Date and ISO strings to yyyy-MM-dd", () => {
    expect(toDateStr("2026-07-10T15:30:00.000Z")).toBe("2026-07-10");
  });
});
