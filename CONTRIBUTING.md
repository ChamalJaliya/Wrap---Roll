# 🤝 Contributing to Wrap & Roll

Thank you for contributing to the Wrap & Roll ecosystem. This guide covers the conventions and workflow that keep the codebase clean, reviewable, and consistent.

---

## Table of Contents

1. [Branch Naming](#1-branch-naming)
2. [Commit Style](#2-commit-style)
3. [Development Workflow](#3-development-workflow)
4. [PR Checklist](#4-pr-checklist)
5. [Architecture Governance (LSA Lock)](#5-architecture-governance-lsa-lock)
6. [Code Standards](#6-code-standards)
7. [Testing Requirements](#7-testing-requirements)
8. [Contract Integrity](#8-contract-integrity)

---

## 1. Branch Naming

Use the following format:

```
<type>/<ticket-or-short-description>
```

| Type | When to Use | Example |
|:--|:--|:--|
| `feat` | New feature | `feat/delivery-geo-tracking` |
| `fix` | Bug fix | `fix/coupon-expires-boundary` |
| `refactor` | Non-breaking refactor | `refactor/order-queue-cache` |
| `test` | Adding/fixing tests | `test/payment-service-spec` |
| `docs` | Documentation only | `docs/api-reference` |
| `chore` | Build, config, tooling | `chore/upgrade-prisma-7` |
| `hotfix` | Production emergency | `hotfix/webhook-sig-bypass` |

**Rules:**
- Lowercase, hyphens only (no underscores, no slashes in the description).
- Keep it under 50 characters.
- Branch off from `develop` (not `main`) for features and fixes.

---

## 2. Commit Style

We follow **Conventional Commits** (`v1.0`):

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

**Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `build`, `ci`  
**Scope:** module name in lowercase: `order`, `payment`, `coupon`, `inventory`, `menu`, `staff`, `auth`

### Examples

```
feat(coupon): add firstOrderOnly validation gate
fix(payment): correct md5sig construction for non-LKR currencies
test(inventory): add unit spec for low-stock event emission
docs(api): update reference with reconciliation endpoint
chore(ci): add test job with lcov coverage upload
```

**Rules:**
- Subject is imperative, present tense: "add" not "added" or "adds".
- No period at the end of the subject line.
- Body wraps at 72 characters.
- Breaking changes: add `BREAKING CHANGE:` footer and `!` after type.

---

## 3. Development Workflow

```bash
# 1. Start from an up-to-date develop
git checkout develop && git pull

# 2. Create your branch
git checkout -b feat/my-feature

# 3. Start the relevant services
npm run start:api &
npm run start:admin &  # or client, cashier, etc.

# 4. Write code + tests
# (see Testing Requirements below)

# 5. Run lint, typecheck, tests before committing
npx nx lint api
npx nx test api
npx nx run api:typecheck

# 6. Commit
git add .
git commit -m "feat(coupon): add firstOrderOnly gate"

# 7. Push and open a PR against develop
git push origin feat/my-feature
```

---

## 4. PR Checklist

Before requesting review, ensure all of the following are true:

### Code Quality
- [ ] `npx nx lint api` passes with no errors
- [ ] `npx nx run api:typecheck` passes
- [ ] No `any` casts added without a `// eslint-disable` comment explaining why
- [ ] No `console.log` left in production code (use `Logger`)

### Tests
- [ ] New business logic has a corresponding unit spec (`*.service.spec.ts`)
- [ ] New API endpoints have a corresponding integration spec (`src/test/*.spec.ts`)
- [ ] `npx nx test api` passes locally
- [ ] Coverage thresholds not regressed (lines ≥ 80%, branches ≥ 75%)

### Contract Integrity
- [ ] `npm run contracts:check:duplicates` passes
- [ ] `npm run lint:centralization` passes (or violations are intentional and documented)
- [ ] No type drift — if you add a Prisma model, update `@wrap-roll/contracts` types
- [ ] No import from `services/api` internals in any `apps/*` or `libs/*` (go through contracts)

### Documentation
- [ ] If you added a new API endpoint, update `docs/api-reference.md`
- [ ] If you changed the data schema, update `ARCHITECTURE.md` ERDs
- [ ] If you changed a workflow, update `OPERATIONS.md`

### Security
- [ ] No direct stock/cost mutations in `InventoryService` — use COGS operations
- [ ] IDOR check added for any new `GET :id` endpoint that a `CLIENT` can access
- [ ] Audit trail (`trackOpsActivity`) added for admin mutations (price changes, deletions, etc.)

---

## 5. Architecture Governance (LSA Lock)

> **ARCHITECTURE.md is LOCKED.** Structural deviations require a formal RFC.

What constitutes a **structural change** requiring an RFC:
- Adding a new service layer or shared library
- Changing how authentication/roles flow
- Modifying the Prisma schema in a breaking way (removing columns, changing types)
- Adding a new external integration (new payment gateway, SMS provider)
- Changing the monorepo layer boundaries (e.g. having an `apps/*` import from `services/api`)

**RFC Process:**
1. Open a GitHub Discussion titled `RFC: <topic>`.
2. Describe the motivation, proposed change, and migration path.
3. Get sign-off from the core team before implementation.

---

## 6. Code Standards

### TypeScript

- Strict mode is on — no `any` without documented justification.
- Prefer `unknown` over `any` for external/unvalidated inputs.
- Use Zod for runtime validation at API boundaries (already wired — see `nestjs-zod`).
- Use `Prisma.Decimal` for all monetary and quantity fields.

### NestJS Conventions

- Use `@Injectable()` services — no standalone functions that need Prisma.
- Guards: `@Roles()` via the decorator; never inline role checks in controllers without a reason.
- Async side effects: use transactional outbox + BullMQ workers (no in-process event fallbacks).
- Audit: all admin mutations call `trackOpsActivity(this.prisma, { ... })`.

### Database

- Monetary values stored as `Decimal`, never `Float`.
- Use `$transaction` for multi-step writes to ensure atomicity.
- Log stock changes through `InventoryService.appendMovement` — never direct `ingredient.update({ currentStock })`.
- See `.agents/skills/supabase-postgres-best-practices/SKILL.md` for Postgres optimization guidelines.

---

## 7. Testing Requirements

Every PR that changes business logic must include tests. See [docs/testing-guide.md](./docs/testing-guide.md) for detailed instructions.

**Minimum bar:**

| Change | Required Test |
|:--|:--|
| New service method | Unit spec covering happy + sad paths |
| New API endpoint | Integration spec covering 200 + 4xx |
| New role restriction | Auth-RBAC spec |
| New state machine transition | `order.service.spec.ts` case |
| New inventory operation | `inventory.service.spec.ts` case |

---

## 8. Contract Integrity

`libs/contracts` is the **single source of truth** for shared types between the API and all frontends.

- Never import types from `services/api/src` in `apps/*`.
- When you add a Prisma model or a new API response shape, add the corresponding Zod schema and TypeScript type to `libs/contracts` and run `npm run contracts:check:duplicates`.
- When you add computed fields to a queue response, update `QueueOrder` in `@wrap-roll/contracts` and add a projection test in `order-queue-projection.spec.ts`.
