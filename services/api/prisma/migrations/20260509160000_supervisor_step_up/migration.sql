-- Step-up supervisor PIN (hashed) + elevation sessions + audit (POS advanced operations).

CREATE TABLE "StaffSupervisorPin" (
    "staffUserId" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffSupervisorPin_pkey" PRIMARY KEY ("staffUserId")
);

CREATE TABLE "SupervisorElevationSession" (
    "id" TEXT NOT NULL,
    "elevationToken" TEXT NOT NULL,
    "cashierUserId" TEXT NOT NULL,
    "supervisorUserId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'privileged_operations',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupervisorElevationSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupervisorElevationSession_elevationToken_key" ON "SupervisorElevationSession"("elevationToken");

CREATE INDEX "SupervisorElevationSession_cashierUserId_expiresAt_idx" ON "SupervisorElevationSession"("cashierUserId", "expiresAt");

CREATE TABLE "SupervisorElevationAudit" (
    "id" TEXT NOT NULL,
    "cashierUserId" TEXT NOT NULL,
    "cashierEmail" TEXT,
    "supervisorUserId" TEXT,
    "supervisorEmail" TEXT,
    "action" TEXT NOT NULL,
    "scope" TEXT,
    "success" BOOLEAN NOT NULL,
    "detailJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupervisorElevationAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupervisorElevationAudit_cashierUserId_createdAt_idx" ON "SupervisorElevationAudit"("cashierUserId", "createdAt");
