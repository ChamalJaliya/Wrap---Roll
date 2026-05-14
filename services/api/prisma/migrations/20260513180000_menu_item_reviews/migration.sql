-- Dish reviews: enum, MenuItem aggregates, MenuItemReview table + FKs + indexes.
-- Apply with: `cd services/api && npx prisma migrate deploy` (or `prisma migrate dev` locally).

DO $$
BEGIN
  CREATE TYPE "MenuItemReviewVisibility" AS ENUM ('pending', 'public', 'hidden');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "averageRating" DECIMAL(4,2);
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "reviewCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "MenuItemReview" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "visibility" "MenuItemReviewVisibility" NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItemReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MenuItemReview_customerId_orderId_menuItemId_key"
  ON "MenuItemReview"("customerId", "orderId", "menuItemId");

CREATE INDEX IF NOT EXISTS "MenuItemReview_menuItemId_createdAt_idx"
  ON "MenuItemReview"("menuItemId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "MenuItemReview_customerId_createdAt_idx"
  ON "MenuItemReview"("customerId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "MenuItemReview_visibility_createdAt_idx"
  ON "MenuItemReview"("visibility", "createdAt" DESC);

DO $$
BEGIN
  ALTER TABLE "MenuItemReview" ADD CONSTRAINT "MenuItemReview_menuItemId_fkey"
    FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "MenuItemReview" ADD CONSTRAINT "MenuItemReview_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "MenuItemReview" ADD CONSTRAINT "MenuItemReview_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
