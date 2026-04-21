import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), 'services/api/.env') });
config({ path: resolve(process.cwd(), 'services/api/.env.local'), override: true });
