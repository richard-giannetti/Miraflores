import { describe, expect, it } from "vitest";
import { conflictsWith, isRoomAvailable } from "@/lib/availability";

describe("isRoomAvailable — the core conflict predicate", () => {
  const booked = [{ checkIn: "2026-07-10", checkOut: "2026-07-12" }];

  it("allows a stay entirely before an existing booking", () => {
    expect(isRoomAvailable("2026-07-05", "2026-07-08", booked)).toBe(true);
  });

  it("allows a stay entirely after an existing booking", () => {
    expect(isRoomAvailable("2026-07-15", "2026-07-18", booked)).toBe(true);
  });

  it("allows a back-to-back arrival on the departure day", () => {
    // guest leaves the morning of the 12th, next guest arrives the 12th
    expect(isRoomAvailable("2026-07-12", "2026-07-14", booked)).toBe(true);
  });

  it("allows a back-to-back departure on the arrival day", () => {
    expect(isRoomAvailable("2026-07-08", "2026-07-10", booked)).toBe(true);
  });

  it("rejects a stay that starts inside an existing booking", () => {
    expect(isRoomAvailable("2026-07-11", "2026-07-13", booked)).toBe(false);
  });

  it("rejects a stay that ends inside an existing booking", () => {
    expect(isRoomAvailable("2026-07-08", "2026-07-11", booked)).toBe(false);
  });

  it("rejects a stay that fully contains an existing booking", () => {
    expect(isRoomAvailable("2026-07-09", "2026-07-14", booked)).toBe(false);
  });

  it("rejects a stay fully contained by an existing booking", () => {
    expect(isRoomAvailable("2026-07-10", "2026-07-11", booked)).toBe(false);
  });

  it("rejects an identical stay", () => {
    expect(isRoomAvailable("2026-07-10", "2026-07-12", booked)).toBe(false);
  });

  it("rejects zero-length and inverted ranges", () => {
    expect(isRoomAvailable("2026-07-20", "2026-07-20", [])).toBe(false);
    expect(isRoomAvailable("2026-07-20", "2026-07-19", [])).toBe(false);
  });

  it("considers all bookings, not just the first", () => {
    const many = [
      { checkIn: "2026-07-01", checkOut: "2026-07-03" },
      { checkIn: "2026-07-20", checkOut: "2026-07-22" },
    ];
    expect(isRoomAvailable("2026-07-21", "2026-07-23", many)).toBe(false);
    expect(isRoomAvailable("2026-07-10", "2026-07-12", many)).toBe(true);
  });

  it("treats an out-of-order block like a booking", () => {
    const ooo = [{ startDate: "2026-07-15", endDate: "2026-07-18" }];
    expect(isRoomAvailable("2026-07-16", "2026-07-17", [], ooo)).toBe(false);
    expect(isRoomAvailable("2026-07-18", "2026-07-20", [], ooo)).toBe(true);
  });
});

describe("conflictsWith — used when editing a reservation", () => {
  const bookings = [
    { id: "a", checkIn: "2026-07-10", checkOut: "2026-07-12" },
    { id: "b", checkIn: "2026-07-20", checkOut: "2026-07-22" },
  ];

  it("detects a conflict with a different reservation", () => {
    expect(conflictsWith("2026-07-11", "2026-07-13", bookings)).toBe(true);
  });

  it("ignores the reservation being edited", () => {
    // Extending reservation 'a' from [10,12) to [10,13) overlaps its own old
    // range; without the ignore it would falsely report a conflict...
    expect(conflictsWith("2026-07-10", "2026-07-13", bookings)).toBe(true);
    // ...but ignoring 'a' lets the edit through (no other booking is touched).
    expect(conflictsWith("2026-07-10", "2026-07-13", bookings, "a")).toBe(false);
  });

  it("still catches a conflict with a third booking when ignoring self", () => {
    const withNeighbour = [
      ...bookings,
      { id: "c", checkIn: "2026-07-13", checkOut: "2026-07-15" },
    ];
    // Ignoring 'a', extending into the 13th now collides with 'c'.
    expect(conflictsWith("2026-07-10", "2026-07-14", withNeighbour, "a")).toBe(true);
  });

  it("returns false when there is genuinely no overlap", () => {
    expect(conflictsWith("2026-07-13", "2026-07-19", bookings)).toBe(false);
  });
});
