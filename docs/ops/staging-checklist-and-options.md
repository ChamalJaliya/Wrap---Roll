# Staging: execution checklist + options (learn the tradeoffs)

Use **Part A** as your copy-paste progress list. When a step feels unclear, read the matching row in **Part B** to see *other* valid options and *why* a default is suggested for a first-timer on AWS + this monorepo.

**Prereq reading:** [`deployment-first-time-guide.md`](deployment-first-time-guide.md) (mental model + glossary).  
**Deep reference:** [`staging-deployment-guide.md`](staging-deployment-guide.md) (full staging + AWS mapping).

---

## Part A — Execution checklist

Check boxes in order. If something fails, use **Part B** and the “first debug” list in [`deployment-first-time-guide.md`](deployment-first-time-guide.md) §8.

### 0. Safety and accounts

- [ ] Password manager in use for all new logins.
- [ ] **GitHub** access to this repo.
- [ ] **Supabase** account; you will create a **dedicated staging project** (separate from any future production project).
- [ ] **AWS** account created; **billing alarm** (e.g. AWS Budgets) set to a low threshold so you get email if costs spike.
- [ ] (Optional but good) **Domain** registered, or you accept using temporary `*.amazonaws.com` / platform URLs until DNS is ready — see Part B “Domains & TLS”.

### 1. Staging data plane (Supabase)

- [ ] New Supabase project: name it clearly (e.g. `wrap-roll-staging`).
- [ ] Save **non-committed** copy of: project URL, `anon` key, `service_role` key, `DATABASE_URL` / `DIRECT_URL` (from Supabase **Settings → Database**; Prisma needs the right format — see [`services/api/.env.example`](../../services/api/.env.example)).
- [ ] Decide staging **Auth** users policy (who creates staff users; metadata roles `ADMIN`, `CASHIER`, etc. per existing docs).

### 2. Redis (queues)

- [ ] Managed Redis provisioned (staging).
- [ ] `REDIS_URL` saved in secrets store / private notes (same format your local `.env` uses: `redis://...` or TLS variant your provider documents).

### 3. Build artifact readiness

- [ ] From repo root, you can run a **production API build** locally: `npx nx build api` (confirms the code compiles for deploy).
- [ ] You have a plan for **worker** build: `nx run api:build-worker` or equivalent per [`package.json`](../../package.json) — worker entry is separate `dist` output.
- [ ] **Docker:** either you add a production **Dockerfile** (multi-stage) or you use a platform that builds Node from `package.json` without Docker — see Part B “How to run Node in the cloud”.

### 4. API on HTTPS (first cloud milestone)

- [ ] Container image or build output exists; image pushed to **ECR** (if using ECS) or platform registry.
- [ ] Service runs with `NODE_ENV=production`.
- [ ] `CORS_ORIGINS` set to a comma-separated list of **every** browser origin you will use (exact URLs). For early experiments, include temporary preview URLs; update when you add domains.
- [ ] `TRUST_PROXY=1` (or `true`) if traffic passes through **ALB** or another reverse proxy.
- [ ] Supabase + `DATABASE_URL` + Redis vars injected via **Secrets Manager / SSM / platform secrets** — not baked into the image.
- [ ] Smoke: `curl` or browser call to a simple **GET** endpoint returns **200** over **HTTPS** (not HTTP-only for real staging).

### 5. Worker service

- [ ] Second service running **same image**, **different command**: worker (`start:worker` equivalent).
- [ ] Same `REDIS_URL` and DB credentials as API.
- [ ] Smoke: enqueue something (e.g. place an order path that hits queue) and confirm worker logs show processing — not silent forever.

### 6. Database migrations (staging)

- [ ] Run `npx prisma migrate deploy` from `services/api` against **staging** `DATABASE_URL` (after you trust the connection string — wrong DB is catastrophic).
- [ ] Optional: seed staging data if your process uses [`npm run seed`](../../README.md) — only on **staging**, never blindly on prod.

### 7. PayHere (sandbox)

- [ ] Sandbox merchant ID + secret in API env.
- [ ] Webhook URL in PayHere dashboard points to **`https://<your-api-host>/api/payment/webhook`** (confirm path matches your deployed API global prefix).
- [ ] One **sandbox** payment completes and order state updates in DB.

### 8. Next.js apps (repeat per app or automate)

Deploy **client** first if you want the smallest slice; then admin, cashier, kitchen, delivery.

- [ ] Build: `nx run <app>:build` (or project-specific production build).
- [ ] Runtime env: `NEXT_PUBLIC_SUPABASE_*` for **staging** Supabase project.
- [ ] Server-side **`API_PROXY_TARGET`** points to your staging API’s Nest base (including `/api` as your [`apps/client/.env.example`](../../apps/client/.env.example) pattern expects).
- [ ] Add each deployed site **origin** to API **`CORS_ORIGINS`** (scheme + host + no trailing slash unless your code expects it — be consistent).
- [ ] Open each URL over HTTPS; login/smoke as appropriate.

### 9. Mobile (Expo)

- [ ] EAS / Expo profile for **staging** with `EXPO_PUBLIC_SUPABASE_*` and `EXPO_PUBLIC_API_URL` aimed at staging ([`apps/mobile/.env.example`](../../apps/mobile/.env.example)).
- [ ] Install build on device; one login + browse path works.

### 10. Final staging sign-off

- [ ] Customer path: menu → checkout → **sandbox** PayHere → order visible in kitchen/cashier/admin as designed.
- [ ] Staff roles: at least one user per role you rely on; confirm **403** for wrong role where expected.
- [ ] Document **URLs**, **which AWS region**, and **where secrets live** for your future self.

---

## Part B — Choices explained (recommended vs alternatives)

Each row is a decision you will hit. The **recommended** column matches “first staging + AWS compute + keep this repo’s Supabase auth.” If your situation differs, use the **when to pick an alternative** column.

### B1. Database and authentication

| | **Recommended** | **Alternatives** | **Why we pick recommended** | **When to pick an alternative** |
| --- | --- | --- | --- | --- |
| Where Postgres + user login live | **Supabase** (a **second** project named for staging) | **Amazon RDS** (Postgres) + **Cognito** or custom JWT issuer | This codebase already uses Supabase URLs and JWT validation paths wired to Supabase. You deploy **compute**; DB/auth stay managed. | Enterprise mandates all data in your AWS account; you have time for a **migration project** (schema + auth + seed + RBAC retest). |

### B2. Redis (BullMQ)

| | **Recommended** | **Alternatives** | **Why we pick recommended** | **When to pick an alternative** |
| --- | --- | --- | --- | --- |
| Managed Redis | **Amazon ElastiCache for Redis** in the **same VPC** as ECS tasks | **Upstash**, **Redis Cloud**, Redis on a small **EC2** (not ideal ops) | Lowest latency and **private network** path from API/worker to Redis; fewer random egress issues. | You want **zero VPC setup** for week one: Upstash is fine for **early** staging; switch to ElastiCache when you commit to AWS networking. |

### B3. How to run the API and worker (AWS)

| | **Recommended** | **Alternatives** | **Why we pick recommended** | **When to pick an alternative** |
| --- | --- | --- | --- | --- |
| Long-running Node processes | **ECS on Fargate** — **two services** (API + worker), **ALB** in front of API only | **App Runner** (simpler, fewer knobs); **EC2** + systemd or PM2; **Lambda** (poor fit for long-lived Nest + SSE patterns) | ECS is the **standard** AWS pattern for always-on containers, separate scaling for worker vs API, and **VPC** placement next to ElastiCache. | You want the **fastest** AWS path for **only the API** → try App Runner **only if** you accept a separate solution for the **worker** and Redis VPC wiring may differ. **Lambda** is a bad default here unless you redesign around short requests. |

### B4. Container images

| | **Recommended** | **Alternatives** | **Why we pick recommended** | **When to pick an alternative** |
| --- | --- | --- | --- | --- |
| Packaging | **Docker image** in **ECR**; build in CI or locally at first | Buildpack-only platforms (**Heroku-style**) that build from Git without Dockerfile | Reproducible runs: same image for API and worker with different **CMD**; matches how teams operate Nest at scale. | You use a PaaS that **does not** need Docker (see B7); you trade portability for speed. |

### B5. Secrets

| | **Recommended** | **Alternatives** | **Why we pick recommended** | **When to pick an alternative** |
| --- | --- | --- | --- | --- |
| Storing `DATABASE_URL`, keys | **AWS Secrets Manager** or **SSM Parameter Store** (`SecureString`); inject into ECS task def | **GitHub Actions secrets** only at deploy time; `.env` on a single VPS (weak) | Auditable, rotatable, no secrets in Git; aligns with production readiness expectations in [`production-readiness-checklist.md`](production-readiness-checklist.md). | Solo hackathon: temporary `.env` on one server **only** if you accept redoing it properly before prod. |

### B6. Frontends (five Next.js apps)

| | **Recommended** | **Alternatives** | **Why we pick recommended** | **When to pick an alternative** |
| --- | --- | --- | --- | --- |
| Hosting Next.js | **AWS Amplify Hosting** (one Amplify app per Next app) or **ECS + ALB** per app if you want everything in containers | **Vercel** / **Netlify** / **Cloudflare Pages** for some apps | Amplify keeps you **in AWS** with sane HTTPS + env UI; good SSR story for Next. | Your team already standardized on **Vercel** for frontend-only deploys; or you want the **fastest** preview URLs with minimal AWS UI — totally valid; keep **`CORS_ORIGINS`** in sync. |

### B7. “Training wheels” outside AWS (non-default but educational)

| | **Recommended** | **Alternatives** | **Why we pick recommended** | **When to pick an alternative** |
| --- | --- | --- | --- | --- |
| First deploy ever | Still aim at **AWS** if that is your target — use **Part A** slowly | **Railway**, **Render**, **Fly.io**: often **one click** Postgres/Redis + web service | Learning **AWS IAM + VPC + ECS** has a curve; PaaS teaches **env vars, HTTPS, logs** with fewer screens. | You feel stuck after **two weekends** on ECS — deploy API + worker on a **PaaS** to learn *deploy mechanics*, then **repeat** on AWS. Same app; different host. |

### B8. Domains and TLS

| | **Recommended** | **Alternatives** | **Why we pick recommended** | **When to pick an alternative** |
| --- | --- | --- | --- | --- |
| DNS + certificates | **Route 53** hosted zone + **ACM** cert for **ALB** (and CloudFront if used) | DNS at **Cloudflare** or your registrar; cert still from **ACM** for AWS-native ALB | Single-provider flow for AWS tutorials; ALB integrates cleanly with ACM in the **same region**. | Domain already on Cloudflare — use it; just **validate** ACM via DNS CNAMEs AWS gives you. |

### B9. CI/CD

| | **Recommended** | **Alternatives** | **Why we pick recommended** | **When to pick an alternative** |
| --- | --- | --- | --- | --- |
| Deploy pipeline | **GitHub Actions**: test → build → push **ECR** → update **ECS** service | **AWS CodePipeline** + CodeBuild | Your repo already uses GitHub Actions ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)); extend it when ready. | Enterprise wants **everything** inside AWS with IAM-bound pipelines — CodePipeline becomes attractive. |

---

## How this checklist relates to “production”

Staging uses **sandbox PayHere** and a **separate Supabase project**. Production repeats the same **shape** (API + worker + Redis + apps + secrets + HTTPS) with **live** credentials and stricter checklists: [`docs/MVP_LAUNCH_CHECKLIST.md`](../MVP_LAUNCH_CHECKLIST.md).

---

## Related docs

| Doc | Role |
| --- | --- |
| [`monorepo-deploy-where-each-app-goes.md`](monorepo-deploy-where-each-app-goes.md) | **Which app deploys where** (Amplify vs API vs worker vs Expo) |
| [`deployment-first-time-guide.md`](deployment-first-time-guide.md) | Story + glossary + first-debug order |
| [`staging-deployment-guide.md`](staging-deployment-guide.md) | Staging goals + AWS §4 mapping |
| [`production-readiness-checklist.md`](production-readiness-checklist.md) | Formal gates before real customers |
