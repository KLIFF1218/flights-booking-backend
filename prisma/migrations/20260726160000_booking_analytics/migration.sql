-- CreateTable
CREATE TABLE "BookingAnalyticsDaily" (
    "date" DATE NOT NULL,
    "bookingsCreated" INTEGER NOT NULL DEFAULT 0,
    "paymentsSucceeded" INTEGER NOT NULL DEFAULT 0,
    "paymentsFailed" INTEGER NOT NULL DEFAULT 0,
    "bookingsCanceled" INTEGER NOT NULL DEFAULT 0,
    "ticketsIssued" INTEGER NOT NULL DEFAULT 0,
    "flightsDelayed" INTEGER NOT NULL DEFAULT 0,
    "flightsCancelled" INTEGER NOT NULL DEFAULT 0,
    "paymentVolume" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingAnalyticsDaily_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "ProcessedAnalyticsEvent" (
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedAnalyticsEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE INDEX "ProcessedAnalyticsEvent_occurredAt_idx" ON "ProcessedAnalyticsEvent"("occurredAt");
