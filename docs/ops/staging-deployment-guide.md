# Staging deployment guide

**New to deployment?** Read [`deployment-first-time-guide.md`](deployment-first-time-guide.md) first — mental model, glossary, and phases A–E in plain language.  
**Checklist + “why this option”:** [`staging-checklist-and-options.md`](staging-checklist-and-options.md) (Part A: boxes; Part B: tradeoffs).

This document is the **ordered playbook** for standing up a **staging** environment that mirrors production topology enough to validate releases safely. It complements [`docs/MVP_LAUNCH_CHECKLIST.md`](../MVP_LAUNCH_CHECKLIST.md) (production cutover) and [`docs/ops/production-readiness-checklist.md`](production-readiness-checklist.md) (formal gates).

---

## 1. What “staging” should achieve

| Goal | Why it matters |
| --- | --- |
| **Isolated data** | Staging must use its **own** Postgres + Supabase project so tests never touch production customers or payments. |
| **Same shape as prod** | API + **worker** + **Redis** + HTTPS + real domains exercise CORS, cookies, webhooks, and queues the way prod does. |
| **Safe payments** | Use **PayHere sandbox** and sandbox merchant credentials until you deliberately test live flows. |
| **Release rehearsal** | Migrations (`prisma migrate deploy`), env rotation, and smoke tests run here before production. |

Staging is **not** optional if you plan to ship customer-facing traffic: it is where you catch “works on my laptop” gaps.

---

## 2. Where to start (first week order)

Do these **in sequence**; skipping earlier steps causes rework (especially domains and CORS).

1. **Choose hostnames** — e.g. `staging-api.yourdomain.com`, `staging.yourdomain.com` (client), `staging-admin`, `staging-pos`, etc., or a single subdomain per app. You need a stable list before setting `CORS_ORIGINS` on the API (see [`services/api/src/main.ts`](../../services/api/src/main.ts): production **requires** `CORS_ORIGINS`).
2. **Create a dedicated Supabase project for staging** — new Postgres, new Auth users, new keys. Point Prisma at it via `DATABASE_URL` / `DIRECT_URL` (see [`services/api/.env.example`](../../services/api/.env.example)).
3. **Provision managed Redis** — BullMQ and queue/SSE behavior expect Redis in staging like prod. Local `redis-server` is not a staging solution.
4. **Deploy API + worker** — two processes, same codebase: `start:api` vs `start:worker` (see root [`package.json`](../../package.json)). Both need `REDIS_URL` and the same DB and Supabase secrets.
5. **Run migrations against staging** — from `services/api`: `npx prisma migrate deploy` (after backups / when you have a repeatable process; see [`docs/ops/backups-dr.md`](backups-dr.md)).
6. **Deploy the five Next.js apps** — `client`, `admin`, `cashier`, `kitchen`, `delivery` (`nx run <app>:build` then `next start`, or your platform’s equivalent). Configure **server** env (`API_PROXY_TARGET`) so server-side rewrites reach the staging API.
7. **Configure PayHere sandbox** — webhook URL must hit **staging** API: `https://<staging-api-host>/api/payment/webhook` (verify path in your deployed API).
8. **Mobile staging channel** — Expo/EAS build with `EXPO_PUBLIC_*` pointing at staging Supabase + staging API (see [`apps/mobile/.env.example`](../../apps/mobile/.env.example)).
9. **Smoke test** — place order on staging client → kitchen/cashier/admin update path; one sandbox payment end-to-end.

---

## 3. What to purchase / subscribe to

You do **not** need every vendor below on day one; you **do** need each **capability**. Mix tiers (free vs paid) based on team size and uptime expectations.

| Capability | Typical options | Notes for this repo |
| --- | --- | --- |
| **DNS + TLS** | Cloudflare, your registrar, or included with PaaS | Staging should still use **HTTPS**; the API enables strict CORS and production-safe assumptions when `NODE_ENV=production`. |
| **Postgres + Auth** | **Supabase** (second project for staging) | README and Prisma target Supabase Postgres; keep staging keys out of git. |
| **Redis** | Upstash, Redis Cloud, AWS ElastiCache, Railway/Render Redis add-on | Required for BullMQ/worker alignment with production. |
| **API + worker hosting** | Railway, Render, Fly.io, AWS ECS/Fargate, a small VPS + process manager | Run **two** services from the same image/build: API and worker. Behind TLS termination, set `TRUST_PROXY=1` if the platform uses reverse proxies. |
| **Frontend hosting** | Vercel, Netlify, Cloudflare Pages, or same PaaS as API | Five Next apps = five deployments **or** path-based routing if you consolidate (more complex). |
| **Secrets** | GitHub Actions secrets, Doppler, 1Password Secrets Automation, cloud secret manager | Production readiness expects secrets **not** only on laptops ([`production-readiness-checklist.md`](production-readiness-checklist.md)). |
| **Mobile builds** | Expo EAS (plans vary) | Use a **preview** or **staging** profile so TestFlight/internal APK hits staging URLs. |
| **Email (optional)** | Resend | Invoice email is optional; API documents `RESEND_API_KEY` in [`services/api/.env.example`](../../services/api/.env.example). |

**Domains:** Buy one domain (or use a subdomain of an existing domain) dedicated to staging **or** use platform-generated URLs **only** for early experiments — but you will still need an explicit `CORS_ORIGINS` list that matches the origins browsers actually use.

---

## 4. AWS-oriented staging

This stack maps cleanly to AWS if you treat **compute + Redis + networking + secrets** as AWS-native and decide deliberately where **Postgres and Auth** live.

### 4.1 Two paths for database and auth

| Path | Database / auth | Best when |
| --- | --- | --- |
| **A — AWS compute, Supabase data plane** | Keep a **staging Supabase project** (Postgres + Supabase Auth). Prisma `DATABASE_URL` / JWT verification stay as today. | Fastest path to staging on AWS; matches [`README.md`](../../README.md) and existing guards. API/worker tasks reach Supabase over the **public internet** (TLS); lock down Supabase network rules if offered. |
| **B — Mostly AWS** | **Amazon RDS for PostgreSQL** + replacing Supabase Auth with **Amazon Cognito** (or another IdP) end-to-end. | Major engineering change: migrations, JWT validation, seeding, staff metadata — plan as its own project, not a staging weekend. |

For **first staging**, Path A is realistic. Path B is a **platform migration**, not a hosting migration.

### 4.2 Service mapping (Path A: recommended starting point)

| Wrap & Roll component | AWS building blocks | Practical notes |
| --- | --- | --- |
| **API** (NestJS) | **ECS on Fargate** behind an **Application Load Balancer**, or **App Runner** if you accept fewer knobs | Set `TRUST_PROXY=1`; health checks on your HTTP port; task in **private subnets** with egress via **NAT** if tasks call Supabase/PayHere on the internet. |
| **Worker** (same repo, `start:worker`) | **Second ECS service** (or separate task definition) | Same image, different **command** / entrypoint; share Redis and DB env; scale worker independently from API. |
| **Redis** (BullMQ) | **ElastiCache for Redis** | Prefer same **VPC** as ECS and security groups that allow **ECS → ElastiCache** only on the Redis port. |
| **Postgres + Auth** | **Supabase** (staging project), unchanged | No RDS yet; connection strings in **Secrets Manager**. |
| **Five Next.js apps** | **Amplify Hosting** (Next.js SSR supported), **ECS + ALB** per app, or **CloudFront** in front of a suitable origin | Five apps usually means **five** Amplify apps or five ECS services for parity with local ports (`3000`–`3004` mapped to hostnames). |
| **Container images** | **Amazon ECR** | CI builds the image, pushes to ECR, ECS deploys new task definitions. |
| **Secrets / config** | **Secrets Manager** (rotation-friendly) or **SSM Parameter Store** (`SecureString`) | Inject into ECS task definitions; avoid baking secrets into images. |
| **DNS + TLS** | **Route 53** + **ACM** certificates | ACM certs for ALB (regional) or CloudFront (us-east-1 if using CloudFront); validate via DNS. |
| **Logs & metrics** | **CloudWatch Logs** (containers), **Container Insights** / alarms | Aligns with [`production-readiness-checklist.md`](production-readiness-checklist.md) observability rows. |
| **CI/CD** | **CodePipeline** + **CodeBuild**, or **GitHub Actions** → ECR → **ECS deploy** | Repo CI today does not deploy ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)); add a staging workflow when images exist. |
| **Mobile** | *Outside AWS* unless you add Device Farm etc. | **Expo EAS** preview builds pointing `EXPO_PUBLIC_*` at staging URLs remains the usual approach. |

### 4.3 Networking sketch

- Public subnet: **ALB** only (HTTPS from internet).
- Private subnets: ECS tasks, ElastiCache; **NAT Gateway** (or managed egress) for Supabase, PayHere webhooks **inbound** hit ALB → API only.
- Security groups: narrow sources (ALB → ECS task port; ECS → Redis; optionally ECS → `443` for outbound).

### 4.4 Account and cost hygiene

- Use a **dedicated AWS account** for staging (AWS Organizations) so billing and blast radius are isolated from production.
- Staging **NAT Gateway** and **Fargate** are common cost drivers; for a solo dev, **one small API task + one worker + tiny Redis** is enough until load testing.

---

## 5. Architecture patterns (pick one)

### Pattern A — Frontend on a static/PaaS edge, API on a container/VM

- **Next apps**: deployed separately (common: one project per app or monorepo-aware host).
- **API + worker**: long-running Node processes with health checks; scale API replicas later; **one** worker is enough for staging unless you test concurrency.

### Pattern B — Single platform (Railway, Render, Fly)

- Often faster to wire Redis + API + worker + multiple web services in one place for staging.
- Trade-off: vendor lock-in for staging/prod alignment — acceptable if you document it.

### Pattern C — Kubernetes / EKS

- **EKS** only if you already run clusters and want shared tooling; otherwise **ECS Fargate** (see §4) is simpler for API + worker.

### Pattern D — AWS-first (see §4)

- **Path A:** ECS + ElastiCache + ALB + Supabase + Amplify (or ECS for Next.js).
- **Path B:** add RDS + Cognito when you intentionally migrate off Supabase.

This repo’s **local** [`docker-compose.yml`](../../docker-compose.yml) uses [`Dockerfile.dev`](../../Dockerfile.dev) for development builds. For staging/prod you still need a **repeatable production build** (Node 20+, `nx build`, `prisma generate`) and a **runtime image or Procfile** — see §7.

---

## 6. Environment variables (staging checklist)

Use [`services/api/.env.example`](../../services/api/.env.example) as the source of truth for the API.

**API (minimum for staging HTTPS deployment)**

- `NODE_ENV=production`
- `CORS_ORIGINS` — comma-separated **exact** staging origins (all five Next apps + mobile WebView origins if applicable).
- `DATABASE_URL`, `DIRECT_URL` — staging Supabase connection strings.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — staging project.
- `REDIS_URL` — staging Redis.
- `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET` — **sandbox** credentials for staging.
- `TRUST_PROXY=1` or `true` when behind a reverse proxy / load balancer (see API bootstrap).
- `ENABLE_SWAGGER=false` unless you intentionally expose Swagger behind auth/VPN.

**Each Next app**

- Public Supabase keys aligned with **staging** (`NEXT_PUBLIC_SUPABASE_*`).
- `API_PROXY_TARGET` (server-side) must resolve to your **staging API** base including `/api` where your proxy expects it (see [`apps/client/.env.example`](../../apps/client/.env.example)).
- If you bypass same-origin proxy, set `NEXT_PUBLIC_API_URL` deliberately and ensure API `CORS_ORIGINS` includes that app origin.

**Mobile**

- `EXPO_PUBLIC_SUPABASE_*` and `EXPO_PUBLIC_API_URL` for staging builds.

---

## 7. Known gaps / engineering work before staging is “boring”

These are **repo-realistic** items (not a judgment on quality — staging exists to close them).

| Gap | Why it matters |
| --- | --- |
| **No dedicated production Dockerfile in-repo** | [`Dockerfile.dev`](../../Dockerfile.dev) installs deps for dev; production staging usually wants multi-stage builds, `nx build api`, `node dist/...`, and a slim runtime. Add a `Dockerfile` or platform-native build command in CI. |
| **CI builds but does not deploy** | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs lint, test, build, typecheck — **no** deploy job. You need a manual runbook or a follow-up workflow that deploys from `main`/`develop` with secrets. |
| **CORS must be explicit** | Missing or wrong `CORS_ORIGINS` fails fast in production mode — plan your hostname list early. |
| **Worker must run** | Orders/async paths depend on worker + Redis; deploying API alone will look “broken” for queue-driven behavior. |
| **Observability** | [`production-readiness-checklist.md`](production-readiness-checklist.md) notes logging/alerting gaps — acceptable for **first** staging if someone can `ssh`/dashboard logs during smoke tests. |

Use staging to burn down the **P0** rows in [`production-readiness-checklist.md`](production-readiness-checklist.md) before calling production “ready.”

---

## 8. Smoke tests (staging sign-off)

Minimum bar before you promote a release candidate:

- [ ] Client: browse menu → checkout → **PayHere sandbox** completes → order visible in admin/kitchen/cashier as expected.
- [ ] Cashier: login (staff user with role metadata) → order lifecycle actions allowed by RBAC.
- [ ] Kitchen / delivery: realtime updates (SSE/WebSocket as implemented) without requiring manual full-page refresh for the common path.
- [ ] API: `/api` health or a trivial authenticated read returns **200** behind HTTPS with correct `TRUST_PROXY` behavior.
- [ ] Worker: queue jobs drain (Bull Board only if you **explicitly** enable it for staging and secure it).

Repeat the same themes from [`docs/MVP_LAUNCH_CHECKLIST.md`](../MVP_LAUNCH_CHECKLIST.md) §6–7 using **staging** URLs only.

---

## 9. Related documents

| Document | Use when |
| --- | --- |
| [`staging-checklist-and-options.md`](staging-checklist-and-options.md) | Checkbox staging runbook + alternatives vs recommended picks |
| [`monorepo-deploy-where-each-app-goes.md`](monorepo-deploy-where-each-app-goes.md) | Where each app lands (Amplify, ECS, Expo); monorepo CI mental model |
| [`README.md`](../../README.md) | Local ports, `nx` targets, Prisma/seed basics |
| [`docs/MVP_LAUNCH_CHECKLIST.md`](../MVP_LAUNCH_CHECKLIST.md) | Production cutover (live PayHere, prod Supabase) |
| [`docs/ops/production-readiness-checklist.md`](production-readiness-checklist.md) | Formal P0/P1 gates |
| [`docs/ops/backups-dr.md`](backups-dr.md) | Backup/restore expectations |
| [`docs/delivery-rollout.md`](../delivery-rollout.md) | Delivery feature rollout notes |

---

## 10. Summary

**Start with:** staging DNS names → Supabase staging project → Redis → deploy API + worker with `CORS_ORIGINS` and sandbox PayHere → migrate DB → deploy five web apps → configure mobile staging builds → run smoke tests.

**On AWS (§4):** typically **Route 53 + ACM**, **ALB + ECS Fargate** (API + worker), **ElastiCache**, **ECR**, **Secrets Manager** or **SSM**, **CloudWatch**; keep **Supabase** for staging DB/auth until you plan an intentional **RDS + Cognito** migration.

**Purchase/subscribe:** at minimum a **domain**, **Supabase** (staging project), **Redis** (on AWS: ElastiCache), **AWS** compute/storage for API/worker and frontends, plus **Expo EAS** if mobile staging builds are in scope.

**Engineering work:** production-grade container or build/run automation, deploy pipeline, and explicit env/CORS discipline — the codebase already enforces several production rules in [`services/api/src/main.ts`](../../services/api/src/main.ts); staging is where you validate them end-to-end.
