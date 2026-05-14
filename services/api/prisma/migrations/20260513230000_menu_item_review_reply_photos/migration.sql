-- Optional images on review thread replies (customer + staff).
ALTER TABLE "MenuItemReviewReply" ADD COLUMN IF NOT EXISTS "photoUrls" JSONB NOT NULL DEFAULT '[]'::jsonb;
