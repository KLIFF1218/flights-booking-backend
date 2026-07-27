-- Rename legacy GDS-named provider value to INTERNAL (local inventory only).
ALTER TYPE "BookingProvider" RENAME VALUE 'AMADEUS' TO 'INTERNAL';

ALTER TABLE "Booking" ALTER COLUMN "provider" SET DEFAULT 'INTERNAL'::"BookingProvider";
