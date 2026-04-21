# 🌯 Wrap & Roll — Enterprise Restaurant Ecosystem

[![CI](https://github.com/your-org/wrap-and-roll/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/wrap-and-roll/actions/workflows/ci.yml)

**Wrap & Roll** is a high-fidelity, production-ready hospitality management platform built on a sovereign **Nx Monorepo**. It orchestrates 5 operational frontend interfaces, a hardened NestJS API backbone, and a unified Zod-validated contract layer — all backed by Supabase PostgreSQL.

---

## 📐 System Architecture

The platform follows a strict **4-Layer Topology**:

| Layer | Contents | Technology |
|:--|:--|:--|
| **L3 — Frontend Edge** | 5 App Router applications | Next.js 16, TypeScript |
| **L2 — API Domain** | REST + SSE Gateway | NestJS 11, Prisma 7 |
| **L1 — Shared Core** | Contracts + Design System | Zod, Radix UI, CVA |
| **L0 — Infrastructure** | Storage, Auth, Realtime | Supabase PostgreSQL |

> See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed ERDs, sequence diagrams, and Mermaid topography.

---

## 🚀 Quickstart

### Prerequisites

| Tool | Minimum Version |
|:--|:--|
| Node.js | `>= 20.x` |
| npm | `>= 10.x` |
| Supabase project | URL + Service Role Key |
| PayHere LK account | Sandbox credentials |

### 1 — Install

```bash
git clone <repo-url>
cd wrap-and-roll
npm install
```

### 2 — Configure Environment

```bash
cp .env.example services/api/.env
# Fill in DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
# PAYHERE_MERCHANT_ID, PAYHERE_MERCHANT_SECRET, CORS_ORIGINS
```

### 3 — Database Setup

```bash
# Push Prisma schema to your Supabase instance
cd services/api && npx prisma db push

# Seed high-fidelity demo data (menu, staff, orders, inventory)
npm run seed
```

### 4 — Start Development

```bash
# Redis (local) is started automatically before other services when you use dev:terminals (see scripts/dev/ensure-local-redis.sh).
# macOS: API + five web apps + iOS Simulator (Expo) — one Terminal tab each. Linux: same plus Expo Metro (use Android emulator separately).
npm run dev:all

# Metro only (no native build): npm run dev:terminals:mobile

# Or open a separate terminal for each command you need (SSH, CI, or any headless environment):
npm run ensure:redis:local
npm run start:api      # API server + Swagger UI (also ensures Redis if missing)
npm run start:client   # Customer storefront
npm run start:admin    # Admin back-office
npm run start:cashier
npm run start:kitchen
npm run start:delivery
npm run start:mobile:ios   # macOS: build + iOS Simulator
```

---

## 🛠️ Service Port Map

| Service | Command | Port | Description |
|:--|:--|:--|:--|
| **API** | `npm run start:api` | `4000` | NestJS REST Gateway + Swagger (`/api/docs`) |
| **Client** | `npm run start:client` | `3000` | Customer Ordering, Tracking & Vault |
| **Admin** | `npm run start:admin` | `3001` | Inventory, Analytics, Staff & Coupons |
| **Cashier** | `npm run start:cashier` | `3002` | Offline-Ready POS Terminal (PWA) |
| **Kitchen** | `npm run start:kitchen` | `3003` | Real-time KDS Ticket Board |
| **Delivery** | `npm run start:delivery` | `3004` | Courier Dispatch & Transit Tracking |
| **Redis** | `npm run ensure:redis:local` | `6379` | BullMQ / queues (local dev; skipped if `REDIS_URL` points off-machine) |
| **Mobile (iOS)** | `npm run start:mobile:ios` | `8081` (Metro) | Expo native build + Simulator (macOS + Xcode) |

---

## 👥 Role Matrix

| Role | Description | Key Permissions |
|:--|:--|:--|
| `CLIENT` | Storefront customer | Place orders, track own orders, manage address/payment vault |
| `CASHIER` | POS operator | Create/manage orders, collect payment, view queue |
| `KITCHEN` | Kitchen Display | Advance orders to `in_kitchen` → `ready` |
| `COURIER` | Delivery driver | Move orders `in_transit` → `delivered`, self-assign |
| `ADMIN` | Back-office | All of the above + void/refund in-kitchen orders, manage menu, coupons, staff, inventory, analytics |

> RBAC is enforced at the JWT level (Supabase metadata) and validated by `@Roles()` guards on every protected endpoint.

---

## 🧪 Testing

```bash
# Run all unit + integration tests (mocked Prisma, no DB required)
npx nx test api

# Run with coverage report
npx nx test api --coverage

# Run stress & concurrency tests (requires a real, seeded DB)
RUN_STRESS_TESTS=1 npx nx test api --testPathPattern=stress.spec

# Run Playwright E2E tests for the Admin app
npm run e2e:admin
```

> See [docs/testing-guide.md](./docs/testing-guide.md) for full details on fixtures, mock strategy, and adding new specs.

---

## 📚 Documentation

| Document | Purpose |
|:--|:--|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System topology, ERDs, state machine |
| [OPERATIONS.md](./OPERATIONS.md) | Role-by-role operational workflows |
| [docs/api-reference.md](./docs/api-reference.md) | Human-readable API endpoint reference |
| [docs/testing-guide.md](./docs/testing-guide.md) | Testing handbook & fixture strategy |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Branch naming, commit style, PR checklist |
| [ROADMAP.md](./ROADMAP.md) | Sprint backlog & feature roadmap |

---

## 🛡️ Security Highlights

- **RBAC**: Supabase JWT metadata drives all role enforcement — no client-side trust.
- **IDOR Protection**: `GET /api/orders/:id` verifies `customerId` ownership for `CLIENT` callers.
- **Webhook Hardening**: PayHere `md5sig` verification + DB-backed idempotency key per webhook.
- **Audit Trail**: `StaffAuditLog` captures every admin mutation (price changes, refunds, coupon CRUD).
- **Vault Engine**: Masked payment tokens — only last-4 + brand metadata stored; no raw card data.

---

## 🔧 Useful Commands

```bash
# Lint all projects
npx nx run-many --target=lint --all

# Full production build
npx nx run-many --target=build --all

# Clean build artifacts, Nx cache, and .next folders
npm run clean:local

# Open Prisma Studio (DB browser)
npm run studio:api

# Reset and re-seed the database
npm run db:reset:soft && npm run db:seed

# Contract duplicate check
npm run contracts:check:duplicates
```

---

> **LSA Note**: Architecture is **LOCKED**. Structural changes require a formal RFC documented in [ARCHITECTURE.md](./ARCHITECTURE.md).
