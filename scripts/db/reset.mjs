#!/usr/bin/env node
/**
 * Database reset helpers (development / test databases).
 *
 * Usage:
 *   node scripts/db/reset.mjs soft
 *   node scripts/db/reset.mjs hard --i-understand
 *
 * Hard reset requires --i-understand. For hosted DB (e.g. Supabase), also set
 * WRAP_ROLL_ALLOW_REMOTE_DB_RESET=1.
 *
 * See: docs/ops/database-reset.md
 */

import { execSync } from 'node:child_process';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, '../../services/api');
const migrationsDir = join(apiRoot, 'prisma/migrations');

function run(cmd, opts = {}) {
  execSync(cmd, {
    cwd: apiRoot,
    stdio: 'inherit',
    env: { ...process.env, ...opts.env },
  });
}

function runQuiet(cmd) {
  try {
    execSync(cmd, { cwd: apiRoot, stdio: 'pipe', encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

function listMigrationNames() {
  if (!existsSync(migrationsDir)) return [];
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function isLocalDatabaseUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname;
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local')
    );
  } catch {
    return false;
  }
}

function loadDatabaseUrlSync() {
  const p = join(apiRoot, '.env');
  if (!existsSync(p)) {
    console.error('Missing services/api/.env (DATABASE_URL).');
    process.exit(1);
  }
  const raw = readFileSync(p, 'utf8');
  const line = raw.split('\n').find((l) => l.trim().startsWith('DATABASE_URL='));
  if (!line) {
    console.error('DATABASE_URL not found in services/api/.env');
    process.exit(1);
  }
  const v = line.split('=').slice(1).join('=').trim();
  return v.replace(/^["']|["']$/g, '');
}

function main() {
  const args = process.argv.slice(2);
  const mode = args[0];
  const iUnderstand = args.includes('--i-understand');
  const allowRemote = process.env.WRAP_ROLL_ALLOW_REMOTE_DB_RESET === '1';

  if (mode !== 'soft' && mode !== 'hard') {
    console.log(`
Usage:
  node scripts/db/reset.mjs soft
  node scripts/db/reset.mjs hard --i-understand

soft  — Apply pending migrations, then run prisma db seed (schema + data refresh, no table drop).
hard  — Full data loss: prisma db push --accept-data-loss, mark incremental migrations as applied,
        then seed. Use only on dev/test DBs.

Hard reset always needs --i-understand. Hosted DB (not localhost): also set WRAP_ROLL_ALLOW_REMOTE_DB_RESET=1.
`);
    process.exit(mode ? 1 : 0);
  }

  const databaseUrl = loadDatabaseUrlSync();
  process.env.DATABASE_URL = process.env.DATABASE_URL || databaseUrl;

  if (mode === 'soft') {
    console.log('\n▶ Soft reset: migrate deploy + seed\n');
    run('npx prisma migrate deploy');
    run('npx prisma db seed');
    console.log('\n✅ Soft reset finished.\n');
    return;
  }

  // hard
  if (!iUnderstand) {
    console.error(
      'Hard reset requires --i-understand (destructive). See docs/ops/database-reset.md',
    );
    process.exit(1);
  }

  const local = isLocalDatabaseUrl(databaseUrl);
  if (!local && !allowRemote) {
    console.error(
      'DATABASE_URL points at a non-local host. Set WRAP_ROLL_ALLOW_REMOTE_DB_RESET=1 if this is intentional (test project).',
    );
    process.exit(1);
  }

  console.log('\n▶ Hard reset: schema push (data loss) + migration bookkeeping + seed\n');

  run('npx prisma db push --accept-data-loss');

  const names = listMigrationNames();
  console.log(`\n▶ Marking ${names.length} migration(s) as applied (incremental SQL already covered by schema)…\n`);
  for (const name of names) {
    const ok = runQuiet(`npx prisma migrate resolve --applied "${name}"`);
    if (ok) {
      console.log(`   ✓ ${name}`);
    } else {
      console.log(`   (skip or already recorded) ${name}`);
    }
  }

  run('npx prisma db seed');
  console.log('\n✅ Hard reset finished.\n');
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
