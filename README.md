# Casa — Miraflores Hotel Management (PMS)

A self-hosted property-management system for a single family-run ~20-room hotel.
Built to the "Casa" PRD v1. Priorities, in order:

1. **Conflict-proof reservation calendar** (tape chart) as the main screen
2. Staff **check-in / check-out** flows
3. **Tokenized guest online check-in** (no guest accounts)
4. Mobile **housekeeping board**
5. Owner **reports** (occupancy, ADR, RevPAR)

No payments, no OTA APIs, no native apps in v1 (see PRD non-goals).

## Stack

- **Next.js 15** (App Router) + **TypeScript**, server components + server actions
- **PostgreSQL** + **Prisma**
- **Tailwind CSS**
- Custom email/password auth (bcrypt) with signed-cookie sessions (`jose`); three roles
- **Vitest** for the high-risk availability/conflict logic

## The core guarantee: zero double-bookings

Non-overlap is **enforced by the database**, not just application code. The
migration `prisma/migrations/*_reservation_no_overlap` adds a Postgres GiST
exclusion constraint:

```sql
EXCLUDE USING gist (
  "roomId" WITH =,
  daterange("checkIn", "checkOut", '[)') WITH &&
) WHERE ("status" IN ('CONFIRMED', 'CHECKED_IN'));
```

Two active reservations in the same room whose night-ranges overlap are
**impossible to persist** — even under races or manual edits. Nights are the
half-open range `[checkIn, checkOut)`, so back-to-back stays (one guest leaves,
another arrives the same day) do **not** collide. Postgres is therefore required
(not SQLite). The app also checks availability proactively to give staff instant
feedback and suggest alternative rooms, but the constraint is the backstop.

## Getting started

Requires Node 20+ and a PostgreSQL database.

```bash
# 1. Install
npm install

# 2. Configure — copy and edit secrets
cp .env.example .env
#   DATABASE_URL      Postgres connection string
#   AUTH_SECRET       openssl rand -base64 48
#   ID_ENCRYPTION_KEY openssl rand -base64 32   (must decode to 32 bytes)
#   APP_URL           e.g. http://localhost:3000

# 3. Create the schema (includes the exclusion constraint)
npm run db:migrate        # prisma migrate deploy
#   or, for a dev database: npm run db:migrate:dev

# 4. Seed ~20 rooms + sample reservations + demo users
npm run db:seed

# 5. Run
npm run dev               # http://localhost:3000
```

### Demo logins (password `casa1234`)

| Role | Email | Sees |
|------|-------|------|
| Owner | `owner@casa.test` | Everything, incl. reports, rooms, users |
| Front desk | `frontdesk@casa.test` | Calendar, reservations, check-in/out, housekeeping |
| Housekeeping | `housekeeping@casa.test` | Housekeeping board only |

## What's implemented (PRD P0)

| Req | Feature | Where |
|-----|---------|-------|
| R1 | Room & inventory setup, out-of-order date ranges | `/rooms` |
| R2 | Create/edit/cancel reservations, DB-level conflict prevention, alternative suggestions | `/reservations`, `src/lib/reservations.ts` |
| R3 | Tape chart (rooms × dates), drag-to-move with conflict rejection | `/calendar` |
| R4 | One-click check-in (capture guests/payment) & check-out → room auto-marked dirty | `/frontdesk` |
| R5 | Tokenized guest online check-in, ID upload (encrypted), digital signature, expired/cancelled handling | `/checkin/[token]` |
| R6 | Mobile housekeeping board, priority grouping (turnover first), tap-to-update, near-live refresh, per-room notes | `/housekeeping` |
| R7 | Daily dashboard (arrivals, departures, in-house, occupancy, rooms not ready) | `/` |
| R8 | Owner reports — occupancy, ADR, RevPAR, revenue by source, CSV export | `/reports` |
| R9 | Roles (owner / front desk / housekeeping), audit log on every reservation & room change | `/users`, `src/lib/audit.ts` |

## Data protection (PRD §8)

Guest ID images are **encrypted at rest** (AES-256-GCM, `src/lib/idstore.ts`),
stored outside the web root in `./storage/uploads` (git-ignored), and
**purged 30 days after checkout** by a retention job:

```bash
npx tsx scripts/purge-id-uploads.ts     # run daily via cron
```

> Note (PRD Open Question #1): guest-registration and police-reporting
> requirements are country-specific. Confirm local legal obligations before
> launch — they affect which check-in fields are mandatory and how long
> registration records must be kept.

## Testing

```bash
npm test            # Vitest — availability/conflict & date logic (highest-risk)
npm run typecheck   # tsc --noEmit
npm run build       # production build
```

The unit tests exhaustively cover the overlap predicate (before/after/inside/
containing/identical/back-to-back/out-of-order) and the edit-ignore-self case.
The database exclusion constraint is verified against real Postgres.

## Architecture notes / scaling path

- `source` and `rate` on a reservation are modelled flexibly so **Phase 2**
  (direct booking + Stripe) and **Phase 3** (channel manager for OTA sync) don't
  need a schema rewrite. OTA bookings are entered manually in v1.
- All domain dates are handled as timezone-safe `yyyy-MM-dd` strings
  (`src/lib/dates.ts`) with half-open night semantics.
- Mutations run through server actions; every reservation/room change is
  written to the `AuditLog`.

## Project layout

```
prisma/
  schema.prisma                data model
  migrations/                  init + reservation_no_overlap (exclusion constraint)
  seed.ts                      20 rooms, demo users, sample reservations
scripts/
  purge-id-uploads.ts          GDPR retention job
src/
  lib/                         prisma, auth, availability, reservations, tokens,
                               reports, idstore, dates, validation, audit, format
  app/
    login/                     staff sign-in
    (app)/                     authenticated shell (role-based nav)
      page.tsx                 dashboard (R7)
      calendar/                tape chart (R3)
      reservations/            list + create/edit + detail (R2)
      frontdesk/               check-in / check-out (R4)
      housekeeping/            board (R6)
      reports/                 KPIs + CSV (R8)
      rooms/  users/           setup & roles (R1, R9)
    checkin/[token]/           public guest online check-in (R5)
```
