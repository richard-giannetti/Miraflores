/**
 * Data-retention job (PRD §8): permanently delete guest ID images 30 days after
 * checkout. Run daily via cron, e.g.:
 *   0 3 * * *  cd /app && npx tsx scripts/purge-id-uploads.ts
 *
 * It removes the encrypted file from disk and stamps idImagePurgedAt so staff
 * see "purged" rather than a broken reference.
 */
import { PrismaClient } from "@prisma/client";
import { unlink } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();
const RETENTION_DAYS = 30;

async function main() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000);

  const stale = await prisma.guestCheckIn.findMany({
    where: {
      idImagePath: { not: null },
      idImagePurgedAt: null,
      reservation: {
        status: "CHECKED_OUT",
        checkedOutAt: { lt: cutoff },
      },
    },
    select: { id: true, idImagePath: true, reservationId: true },
  });

  let purged = 0;
  for (const g of stale) {
    if (g.idImagePath) {
      try {
        await unlink(path.join(process.cwd(), g.idImagePath));
      } catch {
        // file already gone
      }
    }
    await prisma.guestCheckIn.update({
      where: { id: g.id },
      data: { idImagePurgedAt: new Date() },
    });
    purged++;
  }

  console.log(`Purged ${purged} guest ID image(s) older than ${RETENTION_DAYS} days post-checkout.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
