-- CreateTable
CREATE TABLE "DomainEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "bookingId" TEXT,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "kafkaTopic" TEXT NOT NULL,
    "kafkaPartition" INTEGER NOT NULL,
    "kafkaOffset" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DomainEvent_idempotencyKey_key" ON "DomainEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DomainEvent_bookingId_occurredAt_idx" ON "DomainEvent"("bookingId", "occurredAt");

-- CreateIndex
CREATE INDEX "DomainEvent_aggregateId_occurredAt_idx" ON "DomainEvent"("aggregateId", "occurredAt");

-- CreateIndex
CREATE INDEX "DomainEvent_eventType_occurredAt_idx" ON "DomainEvent"("eventType", "occurredAt");
