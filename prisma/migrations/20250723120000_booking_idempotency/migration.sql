-- CreateTable
CREATE TABLE "BookingIdempotencyRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL,
    "bookingId" TEXT,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingIdempotencyRecord_userId_status_idx" ON "BookingIdempotencyRecord"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BookingIdempotencyRecord_userId_key_key" ON "BookingIdempotencyRecord"("userId", "key");

-- AddForeignKey
ALTER TABLE "BookingIdempotencyRecord" ADD CONSTRAINT "BookingIdempotencyRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
