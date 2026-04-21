# 🛡️ Backups & Disaster Recovery (DR) Runbook
**Project**: Wrap & Roll (Project ID: `QA-001`)  
**Owner**: DevOps / Operations Group  
**Confidentiality**: LSA-LEVEL RESTRICTED  

---

## 📅 1. Database Persistence & Recovery

### 1.1 Supabase Point-in-Time Recovery (PITR)
Wrap & Roll utilizes Supabase for managed PostgreSQL. Standard operational policy assumes **Pro Tier** or higher to enable PITR.
- **Retention**: 7 days (Standard) / 28 days (Enterprise).
- **Procedure**: 
  1. Access [Supabase Dashboard](https://supabase.com/dashboard).
  2. Navigate to `Database` -> `Backups`.
  3. Select `Point-in-Time Recovery`.
  4. Select a timestamp (accuracy to the second).
  5. Confirm restoration. *Warning: Restoration creates a new database project.*

### 1.2 Manual Database Snapshots (Baseline Backup)
Manual snapshots must be executed before major schema migrations (Sprint S6+).
- **Execution**: 
  ```bash
  # Dump full schema and data
  PGPASSWORD="[DB_PASSWORD]" pg_dump -h db.[PROJECT_REF].supabase.co -U postgres -d postgres > backup_$(date +%F).sql
  ```
- **Storage**: Store in an encrypted S3 bucket (region: `us-east-1` for cross-region redundancy).

---

## 🔑 2. Secret Rotation Protocol

Periodic rotation of critical infrastructure keys is mandatory every 90 days.

### 2.1 Critical Keys
| Secret Name | Location | Dependency |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `services/api/.env` | Cashier Proxy, Server-side ownership bypass |
| `PAYHERE_MERCHANT_SECRET` | `services/api/.env`, `.env.local` | Payment hashing & Webhook validation |
| `SUPABASE_JWT_SECRET` | Supabase Config | JWT Verification in AuthModule |

### 2.2 Rotation Procedure
1. **Generate**: Create a new key in the provider console (Supabase / PayHere).
2. **Staged Update**: 
   - Add the *new* key as a secondary secret if the provider supports multiple keys.
   - Update the `services/api` environment variables via CI/CD (GitHub Actions / Vercel).
3. **Propagation**: 
   - Redeploy the API.
   - In Next.js apps, update the environment variable and trigger a production build.
4. **Invalidate**: Deactivate the *old* key after verifying 0% error rate for 24 hours.

---

## 🚨 3. Disaster Recovery (DR) Runbook

### 3.1 Total Regional Outage (Supabase / Provider Level)
If the primary Supabase region experiences >15 minutes of 504 errors:
1. **Declare Failover**: Notify the LSA and C-level stakeholders.
2. **Standby Infra**: 
   - Spin up a standby Supabase project in an alternate region (e.g., `eu-west-1`).
   - Run `npx prisma db push` from `services/api` pointing to the new DB.
3. **Data Restoration**: 
   - Download the latest manual snapshot from the S3 backup bucket.
   - Restore using `psql`: 
     ```bash
     psql -h db.[NEW_PROJECT_REF].com -U postgres -f backup_latest.sql
     ```
4. **Endpoint DNS Update**: 
   - Update `SUPABASE_URL` and `SUPABASE_ANON_KEY` in all 5 Next.js applications (`client`, `admin`, `cashier`, `kitchen`, `delivery`).
   - Flush CDN (Vercel/Cloudflare).

### 3.2 Local Failover (Developer/On-Premise Resilience)
If cloud providers are unreachable, the Cashier POS must survive via local migration.
- **Path**: The Cashier app stores orders in a `Dexie.js` / `IndexedDB` queue.
- **Failover**: Use a local PostgreSQL instance (Docker) and point the Cashier Proxy to it temporarily until cloud sync resumes.

---

## ✅ 4. Verification Check
- [ ] PITR is enabled in Supabase Production.
- [ ] Manual snapshot confirmed readable by `pg_restore`.
- [ ] Secret rotation validated without downtime (Dry run).
- [ ] DR runbook reviewed by LSA.
