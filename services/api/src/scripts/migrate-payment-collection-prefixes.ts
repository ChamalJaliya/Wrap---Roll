import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), 'services/api/.env') });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  try {
    const [deliveryResult, pickupResult] = await prisma.$transaction([
      prisma.$executeRawUnsafe(`
        UPDATE "Order"
        SET "transactionId" = regexp_replace("transactionId", '^COD_', 'ON_DELIVERY_')
        WHERE "transactionId" ~ '^COD_'
      `),
      prisma.$executeRawUnsafe(`
        UPDATE "Order"
        SET "transactionId" = regexp_replace("transactionId", '^PICKUP_CASH_', 'ON_PICKUP_')
        WHERE "transactionId" ~ '^PICKUP_CASH_'
      `),
    ]);

    console.log(`Updated COD_ -> ON_DELIVERY_: ${Number(deliveryResult)}`);
    console.log(`Updated PICKUP_CASH_ -> ON_PICKUP_: ${Number(pickupResult)}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
