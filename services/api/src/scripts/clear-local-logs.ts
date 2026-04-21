import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { Client } from 'pg';

loadDotenv({ path: path.resolve(process.cwd(), 'services/api/.env') });

const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL (or DIRECT_URL) is required to clear local logs.');
}

const ssl =
  connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false };

const client = new Client({ connectionString, ssl });

async function main() {
  await client.connect();
  await client.query(
    'TRUNCATE TABLE "OpsActivityEvent", "StaffAuditLog", "PaymentEvent" RESTART IDENTITY CASCADE;',
  );
  console.log('Cleared OpsActivityEvent, StaffAuditLog, and PaymentEvent.');
}

main()
  .catch((error) => {
    console.error('Failed to clear local logs:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
