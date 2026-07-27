-- AlterTable
ALTER TABLE "BookingAnalyticsDaily" ADD COLUMN "bookingsExpired" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BookingAnalyticsDaily" ADD COLUMN "ticketingFailed" INTEGER NOT NULL DEFAULT 0;
