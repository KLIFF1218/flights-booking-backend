-- AlterEnum
ALTER TYPE "UserNotificationType" ADD VALUE 'BOOKING_CREATED';
ALTER TYPE "UserNotificationType" ADD VALUE 'PAYMENT_SUCCEEDED';
ALTER TYPE "UserNotificationType" ADD VALUE 'PAYMENT_FAILED';
ALTER TYPE "UserNotificationType" ADD VALUE 'TICKET_ISSUED';
ALTER TYPE "UserNotificationType" ADD VALUE 'BOOKING_CANCELED';

-- AlterTable
ALTER TABLE "UserNotification" ADD COLUMN "sourceEventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UserNotification_sourceEventId_key" ON "UserNotification"("sourceEventId");
