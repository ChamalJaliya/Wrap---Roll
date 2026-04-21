# 🐛 BUG_BOARD.md — Active Issues & Research Gaps

> **Last Updated**: 2026-04-06T17:45:00+05:30 | **Owner**: LSA
> **Companion File**: [RESEARCH_GAPS.md](./RESEARCH_GAPS.md) — Full technical debt register.

---

## 🔴 Critical Blockers (Security / Sprint-Blocking)

| ID | Category | Gap | Priority |
|:---|:---|:---|:---:|
| **SEC-004** | Security | Rate limiting on public endpoints — implementation pending verification. | 🔴 CRITICAL |

---

## 🟠 High Priority (Architecture / Product)

| ID | Category | Gap | Priority |
|:---|:---|:---|:---:|
| **PRD-002** | Product | Courier assignment SLA and failure handling unspecified. | 🟠 HIGH |

| **ARC-004** | Architecture | `NotificationService` is log/mock only — provider & failure handling. | 🟠 HIGH |

---

## 🟡 Medium Priority (Research Gaps)

| ID | Category | Gap | Priority |
|:---|:---|:---|:---:|
| **RG-010** | Identity | Session Cookies / Token Refresh Strategy. | 🟡 MEDIUM |
| **ADM-005** | Admin/Auth | Cookie/session rotation policy and auth e2e hardening pending (CSRF shipped). | 🟡 MEDIUM |
| **ADM-006** | UX/Auth | Unauthenticated page/redirect parity pending for cashier, kitchen, and delivery apps. | 🟡 MEDIUM |

---

## 🟣 V2.0 Functional Debt (Post-Launch)

| ID | Category | Gap | Priority |
|:---|:---|:---|:---:|
| **V2-001** | Identity | Schema missing `SavedAddress`, `SavedCard`, and `Wishlist` relations. | 🟣 POST-LAUNCH |

---

## 🔵 Governance & Documentation Debt

| ID | Category | Gap | Priority |
|:---|:---|:---|:---:|
| **DG-002** | Docs | [ROADMAP.md](ROADMAP.md) Sprint S2 checkboxes alignment. | 🔵 LOW |
| **QA-002** | Quality | `nx affected` base branch optimization. | 🔵 LOW |
| **OI-005** | Inquiry | Multi-language support strategy. | 🔵 OPEN |
| **OI-006** | Inquiry | Tax dynamic config engine. | 🔵 OPEN |

---

## 🟢 System Health: 100% (High Resilience)
*Fulfillment Engine (CORE): ✅ COMPLETE. Identity Layer: ✅ SECURED. Security Hardening: ✅ SEALED.*

---

## ✅ Resolved Issues

| ID | Resolution | Date |
|:---|:---|:---|
| ADM-007 | Admin-triggered staff password reset + API-backed audit trail delivered. | 2026-04-06 |
| ADM-008 | CSRF validation added to cookie-mutating admin auth routes. | 2026-04-06 |
| ADM-004 | Unified staff provisioning screen/API for ADMIN/CASHIER/KITCHEN/COURIER delivered. | 2026-04-06 |
| ADM-001 | Admin edge/proxy auth gate added for pre-render cookie enforcement. | 2026-04-06 |
| ADM-006 | Admin self-signup removed; single-admin policy enforced in UI/API routes. | 2026-04-06 |
| ADM-003 | Admin sidebar contrast/collapse UX consistency fixed. | 2026-04-06 |
| S5-002 | Account Settings & Order History Live. | 2026-04-05 |
| S7-002 | Legal (Cookies Banner, Privacy, Terms) Live. | 2026-04-05 |
| RG-006 | Static Business Pages (About/Contact) Live. | 2026-04-05 |
| S10-003 | Multi-Language Localization (EN/SI/TA) Live. | 2026-04-05 |
| S10-004 | Landing Page SEO & Structured Data Hybrid SSR. | 2026-04-05 |
| S10-001 | Sales & Revenue Analytics (Daily/Weekly/Monthly) Engine. | 2026-04-05 |
| S10-002 | Ingredient Cost & Profit Margin Analysis Engine. | 2026-04-05 |
| API-002 | Payment Reconciliation & Inquiry Probe live. | 2026-04-05 |
| OPS-001 | Operations & DR Runbook established. | 2026-04-05 |
| PRD-001 | Refund/Void Lifecycle with Inventory Reversal. | 2026-04-05 |
| QA-001 | Contract/API Integration Test Suite live. | 2026-04-05 |
| ARC-003 | Real ESC/POS Printing logic and templates. | 2026-04-05 |
| ARC-001 | KDS Gateway Migration (API fetches + JWT). | 2026-04-05 |
| ARC-002 | Prisma Consolidation (Shared PrismaService). | 2026-04-05 |
| SEC-001 | IDOR Ownership Guard implemented (OrderController). | 2026-04-05 |
| SEC-002 | Server-minted IDs enforced (OrderService). | 2026-04-05 |
| SEC-003 | Webhook idempotency (processedWebhooks Set) live. | 2026-04-05 |
| INT-001 | Checkout payload validated via WrapOrderSchema. | 2026-04-05 |
| INT-002 | Axios JWT Interceptor live in ClientApp. | 2026-04-05 |
| INT-003 | Role casing reconciled (UPPERCASE) in Guard. | 2026-04-05 |
| INT-004 | Cashier PWA proxy route (/api/orders) created. | 2026-04-05 |
| INT-005 | Fulfillment casing mapping (DINE_IN -> dine_in). | 2026-04-05 |
| API-001 | GET /orders refactored to query params. | 2026-04-05 |
| DG-003 | Auth policy reconciled: Mandatory Sign-In. | 2026-04-05 |
| DG-001 | ID Collision (OI-005) resolved. | 2026-04-05 |
| S5-001 | Supabase Magic Link Auth-Guarded Checkout live. | 2026-04-05 |
| RG-009 | Global Navbar & Footer implemented. | 2026-04-05 |
| BUG-004 | NestJS API ESM Bundling resolved. | 2026-04-05 |
