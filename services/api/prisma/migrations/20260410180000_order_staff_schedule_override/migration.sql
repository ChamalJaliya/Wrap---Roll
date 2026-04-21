-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "staffScheduleOverride" BOOLEAN NOT NULL DEFAULT false;
