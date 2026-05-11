# Monorepo deployment: where each app goes (Amplify, ECS, etc.)

You have **one Git repo** (Nx monorepo). That does **not** mean **one** deployment. It means **many deployables** built from the **same** codebase and shared libraries (`libs/`).

---

## 1. First mental model

```
Git repo (wrap-and-roll)
├── apps/client      ──► build ──► Deploy target #1 (e.g. Amplify app "staging-client")
├── apps/admin       ──► build ──► Deploy target #2
├── apps/cashier     ──► build ──► Deploy target #3
├── apps/kitchen     ──► build ──► Deploy target #4
├── apps/delivery    ──► build ──► Deploy target #5
├── apps/mobile      ──► build ──► App Store / Play / Expo OTA (not a “website host”)
├── services/api     ──► build ──► Deploy target #6 (API process)
│                      └── worker build ──► Deploy target #7 (same image, different command)
└── libs/*           ──► no separate deploy — bundled into apps above when you build them
```

- **Deployable** = something that gets a **URL** (or app binary) and **environment variables**.
- Shared **libs** are not deployed alone; they ship **inside** each app’s production bundle.

---

## 2. Where each piece usually lives

There is no single mandatory vendor. Below is the **mapping** + **AWS-shaped default** we document elsewhere (see [`staging-checklist-and-options.md`](staging-checklist-and-options.md)).

| What | Folder / project | What you actually run in production | Typical hosting (pick per row) |
| --- | --- | --- | --- |
| **Customer website** | `apps/client` (Nx: `client`) | `next build` → `next start` (or platform runs SSR for you) | **AWS Amplify Hosting**, **Vercel**, **Netlify**, Cloudflare Pages, or **ECS + ALB** if you want everything on containers |
| **Admin** | `apps/admin` | Same | Same list — usually a **second** Amplify/Vercel **project** with its **own URL** |
| **Cashier** | `apps/cashier` | Same | Same |
| **Kitchen (KDS)** | `apps/kitchen` | Same | Same |
| **Delivery** | `apps/delivery` | Same | Same |
| **API** | `services/api` (Nx: `api`) | `node dist/services/api/main.js` (after `nx build api`) | **ECS Fargate**, App Runner, EC2, Railway, Render — needs **always-on** HTTP server |
| **Worker** | same package, target `api:build-worker` | `node dist/services/api-worker/main.js` | **Same family** as API — **second service**, same image different **command** |
| **Redis** | (not in repo) | Managed Redis | **ElastiCache**, Upstash, Redis Cloud, etc. |
| **Postgres + Auth** | Prisma + Supabase | Connection strings | **Supabase project** (staging vs prod) — not “deployed” from this repo |
| **Mobile** | `apps/mobile` | Expo native bundle | **Expo EAS** builds; binary installed on phones — points at API via `EXPO_PUBLIC_*` |

So: **Amplify (or Vercel, etc.) is for the five Next.js sites.** It is **not** where the Nest API runs unless you use a **different** AWS service (ECS, App Runner) for API/worker — which is the usual split.

---

## 3. “Do we use Amplify for everything?”

**No.** Common split:

| Layer | Often deployed with |
| --- | --- |
| **5 × Next.js** | **Amplify Hosting** (five Amplify apps = five URLs) **or** five Vercel projects — easy HTTPS + env vars per app |
| **API + worker** | **ECS Fargate + ECR + ALB** (or simpler PaaS like Railway/Render if not strict AWS) |
| **Redis** | ElastiCache or external managed Redis |
| **Mobile** | Expo EAS |

Amplify is great for **frontend** monorepos; the **API** is still a **Node server** — Amplify is not the natural home for **two long-running processes** (API + worker) unless you adopt a specific architecture (not the default for this repo).

---

## 4. How monorepo deploy works in CI (walkthrough)

Every platform follows the same **idea**:

1. **Clone** the repo (same branch, e.g. `develop`).
2. **Install** once at the **repository root**: `npm ci` (installs all workspaces; `libs/` available).
3. **Build one project** with Nx — only that app and its dependencies rebuild:

   ```bash
   npx nx build client
   ```

   Nx walks the graph: shared libs build first if needed, then `apps/client`.

4. **Publish the output** of that app:
   - Next.js: usually `apps/client/.next` + `node_modules` + static assets — platforms often run `next start` or their own Node SSR harness.
5. **Repeat** for `admin`, `cashier`, `kitchen`, `delivery` — either **parallel jobs** in GitHub Actions or **five separate Amplify apps** each triggered on push (each with different **app root** / build command).

**API / worker:**

1. `npm ci` at root  
2. `npx nx build api` and `npx nx run api:build-worker`  
3. Package `dist/services/api` and `dist/services/api-worker` into a **Docker image** (recommended) or zip + run `node …` on the server  
4. Deploy **two** services from that image

---

## 5. AWS Amplify + this monorepo (concrete idea)

You typically create **five Amplify apps**, all connected to the **same GitHub repo**:

- Each Amplify app sets **build settings** so the **working directory** or **build command** targets one app, for example:
  - Install: at repo root `npm ci`
  - Build: `npx nx build client` (or `cd apps/client && npx next build` if your Nx setup exposes that)
  - Output / start: whatever Amplify expects for Next.js (Amplify documentation updates over time — follow their “monorepo” guide).

**Important:** Each Amplify app gets its **own** environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `API_PROXY_TARGET`, etc.). Those values are **different per app** only where needed; all must match your **staging API** URL.

---

## 6. Why not one Amplify app for all five?

Those are **five different Next.js apps** (five `next.config.js`, five ports locally). They are **five separate servers** in production unless you:

- merge them into one Next.js app with route groups (major refactor), or  
- put one reverse proxy in front (advanced).

So in practice: **five deploys**, **five URLs** (e.g. `staging.example.com`, `admin-staging.example.com`, …).

---

## 7. Commands reference (from repo root)

After `npm ci`:

| Deployable | Example build |
| --- | --- |
| Client | `npx nx build client` |
| Admin | `npx nx build admin` |
| Cashier | `npx nx build cashier` |
| Kitchen | `npx nx build kitchen` |
| Delivery | `npx nx build delivery` |
| API | `npx nx build api` → entry `dist/services/api/main.js` |
| Worker | `npx nx run api:build-worker` → entry `dist/services/api-worker/main.js` |

Local production-style serve (from [`package.json`](../../package.json)): `npm run serve:client`, etc., each runs `next start` from the matching `apps/<name>` folder.

---

## 8. Related docs

| Doc | Purpose |
| --- | --- |
| [`staging-checklist-and-options.md`](staging-checklist-and-options.md) | Checklists + **why** Amplify vs alternatives |
| [`staging-deployment-guide.md`](staging-deployment-guide.md) | Staging order + AWS ECS/ElastiCache mapping |
| [`deployment-first-time-guide.md`](deployment-first-time-guide.md) | Basics if deployment is new |

---

## 9. Short answers

- **“Are we using Amplify?”** — Only if **you choose** it for the **Next.js** apps. The API/worker are usually **ECS** (or another app host), not Amplify.  
- **“How do I deploy a monorepo?”** — One repo, **many** build commands (`nx build <app>`), **many** deploy targets, shared `npm ci` at root.  
- **“One deploy button?”** — You can add **one** GitHub Actions workflow that runs seven deploy steps (5 sites + API + worker), but under the hood it is still **seven artifacts**.
