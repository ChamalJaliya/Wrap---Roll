# 🏛️ ARCHITECTURE.md — Wrap & Roll Restaurant Ecosystem

> **Document Status**: `v2.1` | **Model**: Professional Governance | **Last Updated**: 2026-04-12
> **Operational Link**: For role-specific workflows, see [OPERATIONS.md](./OPERATIONS.md)

---

## 1. System Topography

**Wrap & Roll** is a high-concurrency, multi-interface restaurant management ecosystem. The architecture is built on a **4-Layer Monorepo** strategy ensuring strict Separation of Concerns (SoC) and a single source of truth for all business contracts.

For a detailed breakdown of how each role (Admin, Cashier, Kitchen, Courier, Customer) interacts with these layers, refer to the [OPERATIONS.md](./OPERATIONS.md) guide.

```mermaid
graph TB
    subgraph L3["Layer 3 — Frontend Edge (Next.js)"]
        CLIENT["🧑‍💻 apps/client\nCustomer Experience"]
        ADMIN["⚙️ apps/admin\nBack-Office Governance"]
        CASHIER["🖥️ apps/cashier\nOffline-Ready POS"]
        KITCHEN["👨‍🍳 apps/kitchen\nLive KDS Board"]
        DELIVERY["🛵 apps/delivery\nCourier Dispatch"]
    end

    subgraph L2["Layer 2 — API Domain (NestJS)"]
        GATEWAY["🛡️ NestJS API Gateway"]
        SVC_ORDER["📦 OrderService"]
        SVC_INV["📊 InventoryService"]
        SVC_VAULT["🔐 CustomerVault"]
        SVC_PRINT["🖨️ PrintService"]
    end

    subgraph L1["Layer 1 — Shared Core (LSA Gated)"]
        CONTRACTS["📋 libs/contracts\nZod Schemas"]
        UI["🎨 libs/shared-ui\nGlobal Design System"]
    end

    subgraph L0["Layer 0 — Persistence & Cloud (Supabase)"]
        PG["🗄️ PostgreSQL\nACID Store"]
        RT["📡 Realtime\nWebSocket Broadcast"]
        AUTH["🔐 Auth Engine\nJWT / Magic Link"]
    end

    subgraph EXTERNAL["External Integrations"]
        PAY["💳 PayHere LK\nPayment Gateway"]
        SMS["🔔 SMS Provider\nOTP & Status"]
    end

    %% Flow Connections
    L3 <-->|REST / WS| GATEWAY
    GATEWAY <-->|Prisma ORM| PG
    GATEWAY <-->|Events| RT
    GATEWAY <-->|Webhooks| PAY
    GATEWAY <-->|API| SMS
    
    %% Dependency Mapping
    L3 -.->|imports| UI
    L3 -.->|validates with| CONTRACTS
    GATEWAY -.->|enforces| CONTRACTS
```

---

## 2. Order Lifecycle & State Machine

The order flows through a hardened state machine. Transitions are restricted and trigger side-effects (Print, Inventory, Notifications) via an Event-Driven architecture.

```mermaid
sequenceDiagram
    participant C as 🧑‍💻 Client App
    participant A as 🛡️ NestJS API
    participant P as 💳 PayHere
    participant I as 📊 Inventory
    participant K as 👨‍🍳 Kitchen (KDS)
    participant N as 🔔 Notification

    C->>A: POST /orders (Status: PLACED)
    A->>A: Validate via WrapOrderSchema
    A-->>C: Return orderId + Payment Hash
    
    C->>P: Redirect to Payment Gateway
    P-->>A: Webhook (Status: PAID)
    
    activate A
    A->>I: Auto-Deduct Stock (Recipe-based)
    A->>K: Broadcast to KDS (WebSocket)
    A->>N: Trigger "Order Confirmed" SMS
    A->>A: Update Status -> PAID
    deactivate A

    K->>A: PATCH /orders/:id (Status: READY)
    A->>N: Trigger "Ready for Pickup" SMS
    
    A->>A: Status -> READY -> IN_TRANSIT -> DELIVERED
```

---

## 3. Data Schema (ERDs)

### 3.1 Operations & Discovery
The core relationship between Menu items, Orders, and the fulfillment lifecycle. In ERDs below, the **CUSTOMER** entity is the persisted customer profile (Prisma `Customer`), which is separate from the Supabase auth role **`CLIENT`** for storefront users.

```mermaid
erDiagram
    MENU_CATEGORY ||--o{ MENU_ITEM : contains
    MENU_ITEM ||--o{ ORDER_ITEM : included_in
    ORDER ||--|{ ORDER_ITEM : "contains"
    COURIER ||--o{ ORDER : "dispatched_by"
    CUSTOMER ||--o{ ORDER : "places"

    ORDER {
        string id PK
        string status
        decimal total
        string fulfillmentType
        datetime placedAt
    }
    MENU_ITEM {
        string id PK
        string name
        decimal basePrice
        json modifierGroupsJson
    }
```

### 3.2 Inventory & COGS (Cost of Goods Sold)
Advanced tracking for ingredient-level stock control and profit margin analysis.

```mermaid
erDiagram
    INGREDIENT ||--o{ RECIPE_INGREDIENT : used_in
    MENU_ITEM ||--o{ RECIPE_INGREDIENT : requires
    INGREDIENT ||--o{ INVENTORY_MOVEMENT : tracks
    ORDER ||--o{ ORDER_COGS_LINE : generates
    INGREDIENT ||--o{ ORDER_COGS_LINE : referenced_by

    INVENTORY_MOVEMENT {
        string id PK
        decimal quantityDelta
        string movementType "CONSUME | RESTOCK | WASTE"
        decimal resultingQty
    }
    ORDER_COGS_LINE {
        string id PK
        decimal qtyConsumed
        decimal unitCostAtSale
        decimal lineCost
    }
```

### 3.3 Customer Identity & Vault
Secure storage for user profiles, saved delivery addresses, and payment tokens.

```mermaid
erDiagram
    CUSTOMER ||--o{ CUSTOMER_ADDRESS : "saves"
    CUSTOMER ||--o{ SAVED_PAYMENT_TOKEN : "vaults"
    
    CUSTOMER_ADDRESS {
        string id PK
        string label "Home | Work"
        string addressLine1
        boolean isDefault
    }
    SAVED_PAYMENT_TOKEN {
        string id PK
        string token "PayHere Masked Token"
        string cardBrand
        string last4
    }
```

---

## 4. Design System — `libs/shared-ui`

We enforce a **Sovereign Design System** built on HSL variables and Atomic Primitives to eliminate duplication across the 5 apps.

### Core Tokens (`tokens.css`)
- **Primary**: `var(--primary)` (Mandarin / Coral)
- **Secondary**: `var(--secondary)` (Deep Onyx)
- **Glassmorphism**: `var(--ui-blur)`, `var(--ui-glow)`
- **Interaction**: `var(--transition-smooth)` (cubic-bezier)

### Master Primitives
1.  **`AppShell`**: Universal responsive layout container.
2.  **`SharedDataGrid`**: High-performance data table for Admin/Cashier.
3.  **`Navbar` / `Footer`**: Standardized identity bars with localization support.
4.  **`StatusPill`**: Animated status indicators.
5.  **`GlassCard`**: Consistent elevation and blur primitives.
6.  **`WrapBuilder` (Logic-Lite)**: Interactive selection components for the menu.

---

## 5. Security & Governance

- **RBAC**: Handled via Supabase JWT metadata. Staff roles: `ADMIN`, `CASHIER`, `KITCHEN`, `COURIER`. Storefront shoppers: `CLIENT` (see `SHOPPER_ROLE` in `@wrap-roll/contracts`).
- **IDOR Protection**: `OrderController` enforces that a user with the `CLIENT` role can only view their own `customerId` or anonymous session orders.
- **Webhook Hardening**: `PaymentService` signature verification + idempotency tokenization.
- **Audit Logging**: `StaffAuditLog` captures all critical mutations (Price changes, Refunds, HR updates).

---

## 6. Development Workflow (NX)

### Project Commands
- **Run All**: `npx nx run-many --target=dev --projects=api,client,admin`
- **Build All**: `npx nx run-many --target=build --all`
- **Test Core**: `npx nx test api` (Contract & Lifecycle tests)
- **Database (dev/test)**: soft vs hard reset, seed, and Prisma hybrid workflow — [docs/ops/database-reset.md](../docs/ops/database-reset.md)

---

> **LSA Note**: This architecture is LOCKED. Structural deviations require a formal RFC.
