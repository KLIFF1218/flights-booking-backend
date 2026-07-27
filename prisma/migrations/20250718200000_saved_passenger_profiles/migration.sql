-- CreateTable
CREATE TABLE "SavedPassengerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "passengerType" "PassengerType" NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "nationality" TEXT NOT NULL,
    "birthPlace" TEXT,
    "passportNumber" TEXT NOT NULL,
    "passportIssuanceDate" TIMESTAMP(3) NOT NULL,
    "passportExpiry" TIMESTAMP(3) NOT NULL,
    "email" TEXT,
    "phoneCountryCode" TEXT,
    "phoneNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedPassengerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedPassengerProfile_userId_idx" ON "SavedPassengerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedPassengerProfile_userId_passportNumber_key" ON "SavedPassengerProfile"("userId", "passportNumber");

-- AddForeignKey
ALTER TABLE "SavedPassengerProfile" ADD CONSTRAINT "SavedPassengerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
