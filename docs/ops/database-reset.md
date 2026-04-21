# Database reset: soft vs hard

This repo uses a **hybrid Prisma workflow**:

| Mechanism | Role |
|-----------|------|
| **`prisma db push`** | Source of truth for the **full** schema (`schema.prisma`). Use when bootstrapping an empty database or after pulling schema changes. |
| **`prisma/migrations/*`** | **Incremental** SQL (extra columns, indexes, new tables). They assume base tables already exist — there is **no** initial “create everything” migration. |

Because of that, **`prisma migrate reset` is not supported** on an empty database until a baseline migration exists (see [Long-term plan](#long-term-plan)).

---

## Commands (from repository root)

| Goal | Command | Data loss |
|------|---------|-----------|
| **Seed only** — re-run the rich seed script (demo catalog, orders, Supabase users). | `npm run seed` | No schema drop; seed **merges** auth users and **adds** data — not a wipe. |
| **Soft reset** — apply pending migrations, then seed. | `npm run db:reset:soft` | No `db push`; safe when you only need migration SQL + fresh seed pass. |
| **Hard reset** — full schema sync from `schema.prisma`, reconcile migration history, then seed. | See below | **Yes** — `db push --accept-data-loss` clears conflicting data. |

### Hard reset (local Postgres)

```bash
npm run db:reset:hard
```

Uses `scripts/db/reset.mjs` with `--i-understand` baked into the npm script.

### Hard reset (hosted DB, e.g. Supabase test project)

Requires an extra guard so a remote URL is not wiped by mistake:

```bash
WRAP_ROLL_ALLOW_REMOTE_DB_RESET=1 npm run db:reset:hard
```

Or run the script directly:

```bash
WRAP_ROLL_ALLOW_REMOTE_DB_RESET=1 node scripts/db/reset.mjs hard --i-understand
```

**Never** use these against production unless you intend to destroy all data.

---

## When to use which

- **Daily dev — schema unchanged, refresh demo data:** `npm run seed` (fastest).
- **Pulled Git with new migration files:** `npm run db:reset:soft` (deploy migrations + seed).
- **Broken / out-of-sync DB, empty DB, or need a clean slate:** `npm run db:reset:hard` (or with `WRAP_ROLL_ALLOW_REMOTE_DB_RESET=1` on hosted).

If `db:reset:soft` fails (e.g. failed migration row in `_prisma_migrations`), use **`prisma migrate resolve`** as described in [Prisma docs](https://www.prisma.io/docs/guides/migrate/troubleshooting), or run a **hard** reset on a **dev-only** database.

---

## Prerequisites

- `services/api/.env` with valid `DATABASE_URL`.
- For seed: Supabase admin variables expected by `services/api/src/seed.ts` (e.g. service role) if you use auth seeding.

---

## Long-term plan

1. **Keep** incremental migrations for production `migrate deploy` and team alignment.
2. **Add a baseline migration** (optional, larger change): generate one initial migration that creates all tables from the current schema, so `prisma migrate reset` works on an empty database without relying on `db push` first. Until then, **`db:reset:hard`** remains the supported “empty DB” path.
3. **CI/CD:** run `prisma migrate deploy` on deploy; avoid `db push` in production unless that is an explicit operational choice.

---

## Related

- `npm run clean:local` — clears Nx cache, `dist`, app `.next` (not the database).
- `package.json` → `prisma.seed` points at `services/api/src/seed.ts`.
