import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function d(offsetDays: number): Date {
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base;
}

const ROOM_TYPES: {
  type: string;
  maxOccupancy: number;
  baseRate: number;
  amenities: string[];
}[] = [
  { type: "double", maxOccupancy: 2, baseRate: 95, amenities: ["wifi", "ac", "tv"] },
  { type: "twin", maxOccupancy: 2, baseRate: 95, amenities: ["wifi", "ac", "tv"] },
  { type: "double", maxOccupancy: 3, baseRate: 120, amenities: ["wifi", "ac", "tv", "balcony"] },
  { type: "suite", maxOccupancy: 4, baseRate: 180, amenities: ["wifi", "ac", "tv", "balcony", "minibar"] },
];

async function main() {
  console.log("Seeding Casa (Miraflores) PMS…");

  // --- Users -------------------------------------------------------------
  const pw = await bcrypt.hash("casa1234", 10);
  const users: Prisma.UserCreateInput[] = [
    { email: "owner@casa.test", name: "Owner", role: "OWNER", passwordHash: pw },
    { email: "frontdesk@casa.test", name: "Front Desk", role: "FRONT_DESK", passwordHash: pw },
    { email: "housekeeping@casa.test", name: "Housekeeping", role: "HOUSEKEEPING", passwordHash: pw },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: u,
      update: { name: u.name, role: u.role, passwordHash: u.passwordHash },
    });
  }
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "owner@casa.test" } });

  // --- Rooms: 20 rooms across 4 floors ----------------------------------
  // Wipe reservation-ish state so re-seeding is idempotent for demos.
  await prisma.checkInToken.deleteMany();
  await prisma.guestCheckIn.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.roomOutOfOrder.deleteMany();
  await prisma.room.deleteMany();

  const roomIds: string[] = [];
  let n = 0;
  for (let floor = 1; floor <= 4; floor++) {
    for (let i = 1; i <= 5; i++) {
      const spec = ROOM_TYPES[n % ROOM_TYPES.length];
      const number = `${floor}0${i}`;
      const room = await prisma.room.create({
        data: {
          number,
          type: spec.type,
          floor,
          maxOccupancy: spec.maxOccupancy,
          baseRate: spec.baseRate,
          amenities: spec.amenities,
          housekeepingStatus: "CLEAN",
        },
      });
      roomIds.push(room.id);
      n++;
    }
  }
  console.log(`Created ${roomIds.length} rooms.`);

  // One room out of order for the next week (exercises R1).
  await prisma.roomOutOfOrder.create({
    data: {
      roomId: roomIds[7],
      startDate: d(1),
      endDate: d(8),
      reason: "Bathroom leak — plumber scheduled",
    },
  });

  // --- Sample reservations ----------------------------------------------
  const firstNames = ["Maria", "James", "Sofia", "Liam", "Emma", "Noah", "Olivia", "Lucas", "Ava", "Mateo", "Chloe", "Hugo"];
  const lastNames = ["Garcia", "Smith", "Rossi", "Dubois", "Muller", "Silva", "Nowak", "Kelly", "Haddad", "Ferrari"];
  const sources = ["WALK_IN", "PHONE", "EMAIL", "BOOKING_COM", "EXPEDIA", "DIRECT"] as const;
  const payments = ["PAID", "PAY_AT_CHECKOUT", "OTA_PREPAID"] as const;

  let created = 0;
  let seedRand = 42;
  const rand = () => {
    // deterministic LCG so seeds are reproducible
    seedRand = (seedRand * 1103515245 + 12345) & 0x7fffffff;
    return seedRand / 0x7fffffff;
  };

  // Spread ~35 stays across rooms over the next 20 days.
  for (const roomId of roomIds) {
    let cursor = -3; // start a few days in the past
    while (cursor < 18) {
      const gap = 1 + Math.floor(rand() * 4); // free days before next stay
      cursor += gap;
      if (cursor >= 18) break;
      const stay = 1 + Math.floor(rand() * 4);
      const checkIn = cursor;
      const checkOut = cursor + stay;
      cursor = checkOut;

      const room = await prisma.room.findUniqueOrThrow({ where: { id: roomId } });
      // occasionally leave gaps / skip
      if (rand() < 0.35) continue;

      const guestName = `${firstNames[Math.floor(rand() * firstNames.length)]} ${
        lastNames[Math.floor(rand() * lastNames.length)]
      }`;
      // Past-dated stays are checked out; today/near-future confirmed.
      let status: "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" = "CONFIRMED";
      if (checkOut <= 0) status = "CHECKED_OUT";
      else if (checkIn <= 0 && checkOut > 0) status = "CHECKED_IN";

      try {
        await prisma.reservation.create({
          data: {
            roomId,
            guestName,
            guestEmail: `${guestName.toLowerCase().replace(/ /g, ".")}@example.com`,
            guestPhone: "+34 600 000 000",
            checkIn: d(checkIn),
            checkOut: d(checkOut),
            adults: 1 + Math.floor(rand() * room.maxOccupancy),
            children: 0,
            ratePerNight: room.baseRate,
            source: sources[Math.floor(rand() * sources.length)],
            paymentStatus: payments[Math.floor(rand() * payments.length)],
            status,
            createdById: owner.id,
            checkedInAt: status !== "CONFIRMED" ? d(checkIn) : null,
            checkedOutAt: status === "CHECKED_OUT" ? d(checkOut) : null,
          },
        });
        created++;
      } catch {
        // exclusion constraint rejected an accidental overlap — skip it
      }
    }
  }
  console.log(`Created ${created} reservations.`);

  // Make a couple of departed rooms dirty for the housekeeping board demo.
  await prisma.room.update({ where: { id: roomIds[2] }, data: { housekeepingStatus: "DIRTY" } });
  await prisma.room.update({ where: { id: roomIds[9] }, data: { housekeepingStatus: "CLEANING" } });

  console.log("Seed complete.");
  console.log("Logins (password: casa1234): owner@casa.test, frontdesk@casa.test, housekeeping@casa.test");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
