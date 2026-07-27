-- AlterEnum
ALTER TYPE "PassengerType" ADD VALUE 'SEATED_INFANT';

-- AlterTable
ALTER TABLE "Traveler" ADD COLUMN "accompanyingTravelerId" TEXT;

-- AddForeignKey
ALTER TABLE "Traveler" ADD CONSTRAINT "Traveler_accompanyingTravelerId_fkey" FOREIGN KEY ("accompanyingTravelerId") REFERENCES "Traveler"("id") ON DELETE SET NULL ON UPDATE CASCADE;
