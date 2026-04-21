# RESEARCH_GAPS.md — Under-Documented & Technical Debt

> **Purpose**: Track integration, security, and documentation gaps surfaced by architecture and code review.  
> **Companion**: [BUG_BOARD.md](./BUG_BOARD.md) (RG-005–RG-011, OI-005–OI-006). This file adds items **not** fully captured there.  
> **Last Updated**: 2026-04-06

---

## 1. Control plane & documentation

| ID | Gap | Notes |
|:---|:---|:---|
| **DG-001** | **Open-inquiry ID collision** | RESOLVED: Orchestration renumbed to **OI-100** in ARCHITECTURE.md. |
| **DG-002** | **ROADMAP drift** | IN PROGRESS: S8 wave 1 sealed in TASK_BOARD and ROADMAP. |
| **DG-003** | **Auth vs guest policy** | RESOLVED: Mandatory sign-in before payment enforced (S5-001). |

---

## 2. API ↔ client ↔ POS contract integrity

| ID | Gap | Notes |
|:---|:---|:---|
| **INT-001** | **Checkout payload vs `WrapOrder`** | RESOLVED: Server-side Zod validation in OrderService ensures contract alignment. |
| **INT-002** | **Missing `Authorization` on Nest calls** | RESOLVED: Axios interceptor in ClientApp handles JWT attachment. |
| **INT-003** | **Role naming matrix** | RESOLVED: SupabaseAuthGuard forces toUpperCase(); Staff roles are ADMIN, CASHIER, KITCHEN, COURIER; storefront shoppers use `CLIENT` (`SHOPPER_ROLE` in `@wrap-roll/contracts`). |
| **INT-004** | **Cashier offline sync path** | RESOLVED: PWA proxy route /api/orders created in CashierApp for sync queue. |
| **INT-005** | **Fulfillment enum casing** | RESOLVED: mapFulfillmentType helper in OrderService handles DINE_IN -> dine_in conversion. |

---

## 3. Security & abuse

| ID | Gap | Notes |
|:---|:---|:---|
| **SEC-001** | **IDOR risk on `GET /orders/:id`** | RESOLVED: Ownership guard in OrderController checks user.sub vs order.customerId. |
| **SEC-002** | **Client-supplied `orderId`** | RESOLVED: OrderService ignores client UUID and uses server-minted UUIDs. |
| **SEC-003** | **Webhook idempotency** | RESOLVED: `PaymentService` uses a deterministic `PaymentEvent` insert (`claimWebhookProcessing`) so duplicate webhooks are ignored (DB uniqueness); safe across multiple API instances. |
| **SEC-004** | **Rate limiting** | RESOLVED: @nestjs/throttler implemented globally. |

---

## 4. Architecture implementation drift

| ID | Gap | Notes |
|:---|:---|:---|
| **ARC-001** | **Kitchen reads DB directly** | RESOLVED: KDS migrated to NestJS API for fetches and status updates. |
| **ARC-002** | **Dual `PrismaClient` subclasses** | RESOLVED: Consolidated to shared PrismaService singleton. |
| **ARC-003** | **Thermal printing** | RESOLVED: PrintService generates ESC/POS bytes via templates. |
| **ARC-004** | **Notifications** | RG-011 covers comms; current `NotificationService` is log/mock only—provider selection, templates, and failure handling remain open. |

---

## 5. API correctness

| ID | Gap | Notes |
|:---|:---|:---|
| **API-001** | **`GET /orders` filter** | RESOLVED: refactored to query params. |
| **API-002** | **Payment source of truth** | RESOLVED: Server Webhook/Inquiry API absolute trigger. |

---

## 6. Quality, CI, and operations

| ID | Gap | Notes |
|:---|:---|:---|
| **QA-001** | **Test coverage** | RESOLVED: Jest/Supertest suite covers Zod contracts and order lifecycles. |
| **OI-005** | **Multi-Language** | RESOLVED: `next-intl` localization implemented for EN/SI/TA. |
| **RG-005** | **Identity Flow** | RESOLVED: Account Settings and Order History live. |
| **RG-006** | **Static Content** | RESOLVED: About Us and Contact pages live. |
| **RG-008** | **Legal/TOS** | RESOLVED: Privacy Policy, Terms, and Cookies Consent logic live. |
| **V2-001** | **Advanced Identity** | UNTRACKED: Prisma schema does not support SavedAddress, SavedCard, or Wishlist models yet. Need to extend the Customer relation. |
| **QA-002** | **`nx affected` base branch** | CI uses `origin/main`; new branches / shallow clones can skew affected graph. |
| **OPS-001** | **Backups & DR** | RESOLVED: Runbook established in docs/ops/backups-dr.md. |

---

## 7. Product / operations (not on BUG_BOARD)

| ID | Gap | Notes |
|:---|:---|:---|
| **PRD-001** | **Refunds & voids** | RESOLVED: Implemented reversal flows with inventory triggers. |
| **PRD-002** | **Dispatch rules** | In-house couriers decided (OI-003); assignment, SLA, and failure handling for delivery app are unspecified. |
| **PRD-003** | **Admin HR & Reporting** | RESOLVED: Analytics suite implemented; staff module capabilities aligned. |
| **RG-007** | **Marketing SEO** | RESOLVED: Hybrid SSR with OpenGraph and JSON-LD implemented. |
| **PRD-004** | **a11y / SEO** | Consumer app accessibility and SEO/structured data not tracked. |

---

## 8. Already tracked elsewhere (do not duplicate work)

Use [BUG_BOARD.md](./BUG_BOARD.md) for: **RG-005–RG-011**, **OI-005 (i18n)**, **OI-006 (tax)**.  
Use [FLOW_BOARD.md](./FLOW_BOARD.md) for lifecycle diagrams.  
Use [ARCHITECTURE.md](./ARCHITECTURE.md) for locked stack and state machine.

---

## 9. Admin domain hardening

| ID | Gap | Notes |
|:---|:---|:---|
| **ADM-001** | **Edge auth enforcement parity** | RESOLVED: admin now has edge/proxy cookie gating before protected route render. |
| **ADM-002** | **Role login entrypoints are fragmented** | PARTIAL: primary admin now supports magic-link + email/password + cookie session; cashier/kitchen/delivery still lack equivalent first-class role entrypoints and provisioning flow. |
| **ADM-003** | **Sidebar token mismatch** | RESOLVED: replaced undefined `sidebar-*` tokens with explicit contrast-safe classes and collapsible UX. |
| **ADM-004** | **Staff module completeness** | PARTIAL: unified cross-role auth user management is now live in admin; courier domain-table sync semantics and deeper lifecycle actions (password reset/audit trail) remain open. |
| **ADM-005** | **Cookie auth hardening depth** | PARTIAL: CSRF validation now enforced on mutating auth endpoints; token rotation/session policy and broader e2e security tests remain open. |
| **ADM-006** | **Ops app unauthenticated UX parity** | OPEN: admin has explicit auth/forbidden flows, but cashier/kitchen/delivery still need standardized unauthenticated pages and redirects. |

---

*New items should be added with the next free ID per section or merged into BUG_BOARD when promoted to sprint-blocking RG/OI.*
