export class PaymentProviderCreateDto {
  transactionId: string;
  amount: string;
  currency: string;
  idempotencyKey: string;
  provider: string;
}
