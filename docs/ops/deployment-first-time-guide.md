# First-time deployment guide (start here if you’ve never deployed)

This doc assumes **zero** deployment experience. It explains **what** you are doing, **why**, and **in what order**.

**Do the work:** follow **[`staging-checklist-and-options.md`](staging-checklist-and-options.md)** — Part A is the checkbox list; Part B explains **recommended picks vs alternatives** and **why** (so you learn while shipping).

**Reference:** [`staging-deployment-guide.md`](staging-deployment-guide.md) (full staging + AWS section).

---

## 1. What “deployment” means (one picture)

**On your laptop:** you run `npm run start:api` and the API listens on `localhost`. Only **your computer** can reach it.

**After deployment:** your code runs on a **computer in the cloud** that is **always on**. The cloud provider gives you a **public URL** (like `https://something.amazonaws.com`). Anyone on the internet — PayHere webhooks, your staging website, your phone — can call that URL.

Deployment = **build** your app → **upload** it (or a **container image**) → **configure secrets** (database passwords, keys) → **start** the process so it keeps running → **attach a domain or HTTPS URL**.

You are not missing a “talent.” This is **procedure + repetition**. Follow checklists; it becomes muscle memory.

---

## 2. The pieces of *this* project (what you will deploy)

Wrap & Roll is not one app. It is several programs that talk to each other:

| Piece | What it is | Runs how locally |
| --- | --- | --- |
| **API** | NestJS server (`services/api`) | `npm run start:api` → port **4000** |
| **Worker** | Background jobs (queues, outbox) — **same repo**, different start command | `npm run start:worker` |
| **Redis** | Message broker for queues (BullMQ) | Must exist **somewhere** staging can reach |
| **Postgres + login users** | Database and auth | This repo uses **Supabase** (you create a **project** there; you don’t install Postgres yourself) |
| **Five websites** | Next.js: client, admin, cashier, kitchen, delivery | Ports **3000–3004** locally |
| **Mobile app** | Expo | Separate build (phone install); points at your API URL via env vars |

**Important:** The **API** and **Worker** are two separate **processes**. In the cloud you usually run **two services** (or two containers) from the **same built code**, with different **commands**.

---

## 3. Tiny glossary (read once, refer back)

| Term | Plain English |
| --- | --- |
| **Environment variable (“env”)** | A named setting the server reads at startup, e.g. `DATABASE_URL=postgresql://...`. Never commit real secrets to Git. |
| **HTTPS** | Encrypted `https://` traffic. Browsers and webhooks expect it in staging/production. |
| **DNS / domain** | Names like `api.staging.yourdomain.com` point to your cloud load balancer or host. |
| **Load balancer (ALB)** | AWS front door: receives HTTPS, forwards to your API containers. |
| **Container / Docker image** | A packaged bundle: OS bits + Node + your built `dist` folder. ECS runs **images**. |
| **Registry (ECR)** | Storage for container images; ECS pulls from here. |
| **CI/CD** | Automated pipeline: push code → tests/build → deploy. Your repo has **CI** (GitHub Actions) but **no deploy yet** — that’s normal; you add deploy when ready. |
| **CORS** | Browser security: your API must **allowlist** the exact origins (URLs) of your websites (`CORS_ORIGINS` in production). Wrong list = browser shows CORS errors. |
| **Staging** | A **safe copy** of production: separate database, sandbox payments, used to practice deploys. |

---

## 4. What to sign up for (before you click around AWS)

Do these in order. Use a **password manager** for all accounts.

- [ ] **GitHub** (you likely have it) — code lives here.
- [ ] **Supabase** — create a **new project** used **only for staging** (not your personal experiments mixed with prod later).
- [ ] **AWS account** — credit card required; turn on **billing alerts** on day one (AWS Budgets / alarm at e.g. $20–50 so surprises don’t happen).
- [ ] **Domain (optional for week one)** — you *can* start with AWS-generated URLs; you **must** still set `CORS_ORIGINS` to match whatever origins your browsers use (including temporary platform URLs — update when domains go live).

PayHere sandbox: keep using **sandbox** credentials until staging behaves end-to-end.

---

## 5. The order that avoids tears

Do **not** deploy five websites before the API works. Use this sequence:

### Phase A — Data layer (no AWS deploy yet)

1. **Supabase staging project** created.
2. Copy connection strings into a **private** notes file (not Git): `DATABASE_URL`, `DIRECT_URL`, Supabase URL + keys (see [`services/api/.env.example`](../../services/api/.env.example)).
3. From `services/api`, run migrations against **staging** when your runbook says so (`prisma migrate deploy` — details in staging guide).
4. **Redis**: provision managed Redis (on AWS: ElastiCache when you’re ready). Save `REDIS_URL`.

Until Redis + DB exist, full queue behavior won’t match production — that’s OK; you’re setting foundations.

### Phase B — First cloud win: API reachable over HTTPS

Goal: open `https://…/api/…` and get a real response (health or docs path per your config).

On AWS this usually means: **build a production API artifact** → put it in a **container** → push to **ECR** → run on **ECS Fargate** or **App Runner** behind **HTTPS**.

Set at minimum:

- `NODE_ENV=production`
- `CORS_ORIGINS` — must include every frontend URL you will use (comma-separated, exact).
- `TRUST_PROXY=1` when behind ALB (see [`services/api/src/main.ts`](../../services/api/src/main.ts)).
- All Supabase + DB + Redis vars the API needs.

**Baby mistake #1:** Forgetting `CORS_ORIGINS` → API refuses browser requests.

**Baby mistake #2:** API can reach DB but **worker not running** → orders/queues look stuck.

### Phase C — Worker

Deploy **second service** with same image, command = worker (`start:worker` equivalent). Same secrets as API for DB/Redis/Supabase.

### Phase D — Five Next.js apps

One app at a time if you want less stress. Each needs correct **`API_PROXY_TARGET`** (server-side) pointing at your **staging API** base URL including `/api` as your app expects (see [`apps/client/.env.example`](../../apps/client/.env.example)).

### Phase E — Mobile

Expo/EAS build with staging `EXPO_PUBLIC_*` vars ([`apps/mobile/.env.example`](../../apps/mobile/.env.example)).

---

## 6. AWS in toddler steps (what to open in the console)

You wanted AWS. Here is the **idea chain** — not every click (AWS tutorials fill that in):

1. **VPC** — private network: put ECS tasks and Redis here.
2. **Subnets** — public (for load balancer) vs private (for tasks + Redis).
3. **Security groups** — firewall rules: who may talk to whom (ALB → API port; API → Redis; API → internet `443` for Supabase/PayHere).
4. **ALB + ACM** — HTTPS certificate + listener forwarding to your API.
5. **ECR** — store your Docker image after CI builds it.
6. **ECS Fargate** — run **two services**: `api` and `worker`.
7. **ElastiCache** — Redis URL for both.
8. **Secrets Manager or SSM** — inject secrets into tasks (not in the image).
9. **CloudWatch Logs** — when something breaks, logs are your friend.

If this paragraph feels heavy: **yes**, AWS has many screens. You learn it once per project. The mapping table is in [`staging-deployment-guide.md`](staging-deployment-guide.md) §4.

**Easier AWS entry (optional):** **App Runner** can run **one** web service with less ECS wiring — you still need Redis and a **separate** worker deployment somewhere; many teams start with ECS Fargate for parity.

---

## 7. Build vs run (why “it works on my machine” isn’t enough)

Locally you run TypeScript / Nest **dev** or build once.

In production **API**, you typically:

1. `npm ci` (clean install)
2. `npx nx build api` (or project build)
3. `node dist/services/api/main.js` (see [`package.json`](../../package.json) patterns)

The cloud host runs **that** Node process, not `npm run dev`.

Your repo does **not** ship a minimal production `Dockerfile` yet — engineering adds a **multi-stage Dockerfile** that builds the API and runs `node dist/...`. That’s listed as a gap in [`staging-deployment-guide.md`](staging-deployment-guide.md) §7.

---

## 8. When something breaks (first debugging order)

1. **Read the logs** (CloudWatch for ECS). Errors almost always say “cannot connect to X” or “env missing.”
2. **Check env vars** on the running service — one typo in `DATABASE_URL` or `REDIS_URL` breaks everything.
3. **CORS** — if the browser console mentions CORS, fix `CORS_ORIGINS` on the API to match the **exact** site URL (scheme + host + port).
4. **HTTPS / webhook** — PayHere must reach `https://your-api-host/api/payment/webhook` (path must match your deployed API).
5. **Worker** — if queues never drain, confirm worker task is **running** and sees same Redis as API.

---

## 9. Your next document

1. **[`monorepo-deploy-where-each-app-goes.md`](monorepo-deploy-where-each-app-goes.md)** — one repo, **many** deploys; Amplify for Next apps vs ECS for API/worker.  
2. **[`staging-checklist-and-options.md`](staging-checklist-and-options.md)** — check every box in Part A; read Part B when you choose tools.  
3. **[`staging-deployment-guide.md`](staging-deployment-guide.md)** — full staging narrative and AWS service mapping (§4).

---

## 10. Mindset

- **First deploy is slow.** The second is faster.
- **Staging exists so you can break things safely.**
- **You don’t need to understand every AWS service on day one** — only the path your app uses (VPC → ALB → ECS → Secrets → Supabase/Redis).

You’ve already shipped a complex monorepo; deployment is **discipline and checklists**, not genius.
