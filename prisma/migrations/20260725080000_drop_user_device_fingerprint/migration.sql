-- Drop unused UserDevice.fingerprint (never written by application code).
ALTER TABLE "UserDevice" DROP COLUMN IF EXISTS "fingerprint";
