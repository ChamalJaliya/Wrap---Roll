# 🗺️ FLOW_BOARD.md — Logical Architecture & Lifecycles

This document visualizes the complex, identity-guarded lifecycles and data flows across the **Wrap & Roll** monorepo.

---

## 👥 RBAC Provisioning & Access Flow

This flow documents the locked staffing model: one admin account provisions and governs operational roles.

```mermaid
sequenceDiagram
    participant A as Admin (apps/admin)
    participant U as Client User (apps/client)
    participant S as Supabase Auth
    participant API as NestJS API
    participant CA as Cashier App
    participant K as Kitchen App
    participant D as Delivery App

    A->>A: Sign in (magic link or password)
    A->>S: Authenticated as ADMIN
    A->>API: Create staff account + assign role claim
    API-->>S: Persist role metadata (CASHIER/KITCHEN/COURIER)
    A->>API: View live ops telemetry (cashier/kitchen/delivery)
    API-->>A: Read-only monitoring feeds and status summaries
    A->>A: Render widget overview cards (cashier / kitchen / delivery)

    Note over A,S: Admin self-signup disabled by policy

    U->>U: Browse as guest or sign in as CLIENT (storefront)
    U->>S: Optional shopper auth session
    S-->>U: CLIENT role (storefront-only capabilities)

    S-->>CA: CASHIER session can access POS only
    S-->>K: KITCHEN session can access KDS only
    S-->>D: COURIER session can access dispatch only
```

---

## 🔐 Identity-Guarded Order Lifecycle (Mandatory Conversion)

This flow documents the **Customer Journey (S5/S6)** where users must sign in before converting a guest cart into a paid order.

```mermaid
sequenceDiagram
    participant G as Guest (ClientApp)
    participant S as Supabase Auth
    participant C as Cart (Zustand)
    participant O as Order Service (API)
    participant P as PayHere (SDK)
    participant K as Kitchen (KDS)

    G->>G: Browse Menu & Home
    G->>C: Add "Classic Shawarma" (Cart Items)
    G->>G: Click "Place Order" (Checkout)
    Note over G: Auth Guard Intercepts
    G->>S: Sign-In / Sign-Up
    S-->>G: Session Cookie (Auth)
    G->>O: POST /orders (Identified with userId)
    O-->>G: Order Draft + Payment Hash
    G->>P: payhere.startPayment()
    P-->>O: Webhook (Paid)
    O->>K: Supabase Realtime (Status: PAID)
    O->>G: Redirect to /order/success
```

---

## 📟 POS Transaction Lifecycle (Offline Resilience)

This flow documents the **Offline Sync (S3)** logic for the Cashier POS.

```mermaid
flowchart TD
    A[Cashier: Create Order] --> B{Internet Online?}
    B -- YES --> C[POST /api/orders]
    B -- NO --> D[Queue: IndexedDB idb]
    D --> E[Background Search API]
    E --> F{Network Restored?}
    F -- YES --> G[Process Queue: Sequential Sync]
    G --> C
    C --> H[Receipt Printed + KDS Sync]
```

---

## 🍔 Fulfillment Lifecycle (Operational State)

The state transition logic across Kitchen and Delivery.

```mermaid
stateDiagram-v2
    [*] --> PLACED: Order Created
    PLACED --> PAID: Payment Verified
    PAID --> IN_KITCHEN: Chef "Starts" Preparation
    IN_KITCHEN --> READY: Chef "Finishes" Preparation
    READY --> IN_TRANSIT: Courier "Picks Up" Order
    IN_TRANSIT --> DELIVERED: Courier "Finalizes" Drop-off
    DELIVERED --> [*]: Mission Success
    
    PLACED --> CANCELLED: Voided by Admin
    PAID --> CANCELLED: Refund Initiated
```

**I have authorized this flow board for 2026 production deployment. 🌯🏢🏛️**
