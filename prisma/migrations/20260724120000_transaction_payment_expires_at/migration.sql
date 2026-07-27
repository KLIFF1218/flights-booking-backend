-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "paymentExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Transaction_paymentExpiresAt_idx" ON "Transaction"("paymentExpiresAt");
