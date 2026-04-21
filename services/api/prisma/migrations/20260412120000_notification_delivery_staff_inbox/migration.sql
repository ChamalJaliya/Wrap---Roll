-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "orderId" TEXT,
    "templateKey" TEXT,
    "toMasked" TEXT,
    "bodyPreview" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffNotification" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkUrl" TEXT,
    "readAt" TIMESTAMP(3),
    "kind" TEXT NOT NULL DEFAULT 'system',
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationDelivery_createdAt_idx" ON "NotificationDelivery"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_orderId_createdAt_idx" ON "NotificationDelivery"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffNotification_recipientUserId_createdAt_idx" ON "StaffNotification"("recipientUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "StaffNotification_recipientUserId_readAt_idx" ON "StaffNotification"("recipientUserId", "readAt");
