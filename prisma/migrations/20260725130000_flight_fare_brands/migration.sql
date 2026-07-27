-- CreateEnum
CREATE TYPE "FareBrand" AS ENUM ('LIGHT', 'FLEX');

-- AlterTable
ALTER TABLE "FlightFare" ADD COLUMN "fareBrand" "FareBrand" NOT NULL DEFAULT 'LIGHT';
ALTER TABLE "FlightFare" ADD COLUMN "changeable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FlightFare" ADD COLUMN "refundable" BOOLEAN NOT NULL DEFAULT false;

-- Drop old uniqueness (brand-blind)
DROP INDEX IF EXISTS "FlightFare_flightInstanceId_passengerType_travelClass_key";
DROP INDEX IF EXISTS "FlightFare_flightInstanceId_passengerType_travelClass_idx";

-- Normalize existing rows as LIGHT demo brand
UPDATE "FlightFare" AS light
SET
  "checkedBags" = CASE WHEN light."travelClass" = 'ECONOMY' THEN 0 ELSE 1 END,
  "changeable" = false,
  "refundable" = false,
  "fareBasis" = light."travelClass" || '_LIGHT'
WHERE light."fareBrand" = 'LIGHT';

CREATE UNIQUE INDEX "FlightFare_inst_ptc_class_brand_key"
  ON "FlightFare"("flightInstanceId", "passengerType", "travelClass", "fareBrand");

CREATE INDEX "FlightFare_inst_ptc_class_brand_idx"
  ON "FlightFare"("flightInstanceId", "passengerType", "travelClass", "fareBrand");

-- Seed FLEX variants from LIGHT (indicative +35% fare, richer conditions)
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
WHERE light."fareBrand" = 'LIGHT';
