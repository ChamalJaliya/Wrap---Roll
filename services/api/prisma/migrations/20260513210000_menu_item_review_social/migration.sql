-- Review photos + threaded replies + helpful reactions (actorKey = c:<customerId> | s:<staffSub>).

DO $$
BEGIN
  CREATE TYPE "MenuItemReviewReplyAuthorKind" AS ENUM ('customer', 'staff');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "MenuItemReview" ADD COLUMN IF NOT EXISTS "photoUrls" JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS "MenuItemReviewReply" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "authorKind" "MenuItemReviewReplyAuthorKind" NOT NULL,
    "customerId" TEXT,
    "staffUserId" TEXT,
    "authorLabel" TEXT NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuItemReviewReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MenuItemReviewReply_reviewId_createdAt_idx"
  ON "MenuItemReviewReply"("reviewId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "MenuItemReviewReply" ADD CONSTRAINT "MenuItemReviewReply_reviewId_fkey"
    FOREIGN KEY ("reviewId") REFERENCES "MenuItemReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "MenuItemReviewReply" ADD CONSTRAINT "MenuItemReviewReply_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MenuItemReviewReaction" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "actorKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuItemReviewReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MenuItemReviewReaction_reviewId_actorKey_key"
  ON "MenuItemReviewReaction"("reviewId", "actorKey");

CREATE INDEX IF NOT EXISTS "MenuItemReviewReaction_reviewId_idx"
  ON "MenuItemReviewReaction"("reviewId");

DO $$
BEGIN
  ALTER TABLE "MenuItemReviewReaction" ADD CONSTRAINT "MenuItemReviewReaction_reviewId_fkey"
    FOREIGN KEY ("reviewId") REFERENCES "MenuItemReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
