# 🗺️ ROADMAP.md — Wrap & Roll

> **Version**: 2.0 | **Last Updated**: 2026-04-07 | **Status**: 🟢 Production Ready

---

## 🏁 Phase 1: Infrastructure & Core Operations (S1 - S4) ✅ COMPLETE
- [x] **Monorepo Scaffold**: NX project with 5 Next.js apps + 1 NestJS API.
- [x] **Data Persistence**: Supabase PG + Prisma ORM integration.
- [x] **Real-time Engine**: KDS (Kitchen) & Dispatch (Delivery) live sync via WebSockets.
- [x] **Offline POS**: PWA Service Worker + IndexedDB queue for Cashier.

## 🏁 Phase 2: Checkout & Identity (S5 - S9) ✅ COMPLETE
- [x] **Auth Guards**: Supabase Magic Link & JWT-based RBAC.
- [x] **Payment Gateway**: PayHere LKR integration with webhook security.
- [x] **Contract Hardening**: Zod schema enforcement across L1-L3 layers.
- [x] **Security Audit**: IDOR protection, rate limiting, and idempotency logic.

## 🏁 Phase 3: Analytics & High-Fidelity (S10 - S14) ✅ COMPLETE
- [x] **Advanced Analytics**: Revenue, Margin, and Source breakdown dashboards.
- [x] **Design Sovereignty**: 20+ Master Primitives in `libs/shared-ui`.
- [x] **Theming**: Centralized HSL tokens for Mandarin Brand (Dark/Light).
- [x] **Localization**: `next-intl` support for English, Sinhala, and Tamil.

## 🏁 Phase 4: Operational Maturity (S15 - S19) ✅ COMPLETE
- [x] **Notification Engine**: Non-blocking SMS/Push order status transitions.
- [x] **Inventory COGS**: Ingredient-level tracking + auto-deduction flow.
- [x] **Smart Menu Engine**: High-performance wrap builder with dynamic pricing.
- [x] **Vault Engine**: Secure customer address book and card tokenization.

---

## 🚧 Sprint S20 — Governance & Final Handover 🔵 ACTIVE
- [ ] **Staff Audit Trail**: Finalize logging for all admin mutations.
- [ ] **Performance Benchmarking**: Stress test the API Gateway and Realtime channels.
- [ ] **Documentation**: Final refresh of ARCHITECTURE.md and technical walkthroughs.
- [ ] **Production Ignition**: Final smoke test of the production PayHere credentials.

---

## 🔮 V2.1 Future Expansions (Post-Launch)
- [ ] **AI-Powered Upselling**: Recommendations based on ingredient pairings.
- [ ] **Loyalty Program**: Tier-based rewards and "Roll Points" system.
- [ ] **Multi-Branch Routing**: Logic for multi-location fulfillment (Branch-specific inventory).
