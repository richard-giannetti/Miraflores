-- Structural guarantee of "zero double-bookings" (PRD Goal 2, R2).
--
-- Two reservations in the SAME room whose night ranges overlap can never both
-- be in an active state. This is enforced by the database, so it holds even if
-- application logic has a bug, two requests race, or someone edits data by hand.
--
-- Night semantics: a stay is the half-open range [check_in, check_out). A guest
-- with check_in = Jul 10, check_out = Jul 12 occupies the nights of the 10th and
-- 11th; the room is free again for a check_in on the 12th. daterange's default
-- '[)' bounds encode exactly this, so back-to-back stays do NOT collide.
--
-- Only CONFIRMED and CHECKED_IN reservations reserve inventory. CANCELLED,
-- NO_SHOW and CHECKED_OUT rows are ignored by the partial WHERE clause, so a
-- cancelled booking frees the room immediately.

-- Equality on a text/enum column inside an exclusion constraint needs btree_gist.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Reservation"
  ADD CONSTRAINT reservation_no_overlap
  EXCLUDE USING gist (
    "roomId" WITH =,
    daterange("checkIn", "checkOut", '[)') WITH &&
  )
  WHERE ("status" IN ('CONFIRMED', 'CHECKED_IN'));

-- Guard the range itself: check_out must be strictly after check_in.
ALTER TABLE "Reservation"
  ADD CONSTRAINT reservation_valid_range
  CHECK ("checkOut" > "checkIn");
