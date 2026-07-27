-- Repair: some dev DBs were baselined without running prior migrations.
-- Idempotent — safe to run on DBs that are already correct.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'BookingProvider'
      AND e.enumlabel = 'AMADEUS'
  ) THEN
    ALTER TYPE "BookingProvider" RENAME VALUE 'AMADEUS' TO 'INTERNAL';
  END IF;
END $$;

ALTER TABLE "Booking" ALTER COLUMN "provider" SET DEFAULT 'INTERNAL'::"BookingProvider";

INSERT INTO "FlightFare" (
  "id",
  "flightInstanceId",
  "passengerType",
  "travelClass",
  "fareBrand",
  "basePrice",
  "currency",
  "checkedBags",
  "changeable",
  "refundable",
  "fareBasis",
  "createdAt",
  "updatedAt"
)
SELECT
  replace(gen_random_uuid()::text, '-', ''),
  light."flightInstanceId",
  light."passengerType",
  light."travelClass",
  'FLEX'::"FareBrand",
  ROUND((light."basePrice"::numeric * 1.35), 2),
  light."currency",
  CASE WHEN light."travelClass" = 'ECONOMY' THEN 1 ELSE 2 END,
  true,
  true,
  light."travelClass" || '_FLEX',
  NOW(),
  NOW()
FROM "FlightFare" AS light
WHERE light."fareBrand" = 'LIGHT'
  AND NOT EXISTS (
    SELECT 1
    FROM "FlightFare" AS flex
    WHERE flex."flightInstanceId" = light."flightInstanceId"
      AND flex."passengerType" = light."passengerType"
      AND flex."travelClass" = light."travelClass"
      AND flex."fareBrand" = 'FLEX'
  );
