import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  migrations: {
    seed: 'npx tsx src/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
