-- Align default user currency with Stripe / international demo (USD).
ALTER TABLE "User" ALTER COLUMN "currency" SET DEFAULT 'USD'::"Currency";
