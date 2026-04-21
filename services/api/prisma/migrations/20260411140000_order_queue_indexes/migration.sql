-- Queue hot path: WHERE status IN (...) [AND placedAt range] [AND fulfillmentType], ORDER BY placedAt DESC
CREATE INDEX IF NOT EXISTS "Order_status_placedAt_idx" ON "Order" ("status", "placedAt" DESC);

-- Delivery board: filter by fulfillmentType + status + time
CREATE INDEX IF NOT EXISTS "Order_fulfillmentType_status_placedAt_idx" ON "Order" ("fulfillmentType", "status", "placedAt" DESC);
