import { Test, type TestingModule } from '@nestjs/testing';
import { StripeService } from './stripe.service';
import { ConfigService } from '@nestjs/config';
import Stripe, { type Checkout } from 'stripe';
import { PaymentProvider, TransactionStatus } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

// Mock Stripe
jest.mock('stripe');

describe('StripeService', () => {
  let service: StripeService;
  let stripe: jest.Mocked<Stripe.Stripe>;
  let configService: jest.Mocked<ConfigService>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    stripe = {
      checkout: {
        sessions: {
          create: jest.fn(),
          retrieve: jest.fn(),
          expire: jest.fn(),
        },
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
    } as any;

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_secret';
        if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test';
        if (key === 'APP_URL') return 'https://example.com';
        return null;
      }),
    } as any;

    prisma = {} as any;

    (Stripe as jest.MockedClass<typeof Stripe>).mockImplementation(() => stripe);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        { provide: ConfigService, useValue: configService },
        { provide: PrismaService, useValue: prisma },
        { provide: Logger, useValue: { error: jest.fn() } },
      ],
    }).compile();

    service = module.get(StripeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPayment', () => {
    it('should create a checkout session with correct parameters', async () => {
      const params = {
        transactionId: 'txn-123',
        bookingId: 'book-123',
        amount: 100,
        currency: 'USD',
        idempotencyKey: 'idempotency-123',
      };

      const mockSession = {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
        payment_status: 'unpaid',
        payment_intent: 'pi_test_123',
        metadata: {
          transactionId: params.transactionId,
          bookingId: params.transactionId,
        },
      } as Checkout.Session;

      stripe.checkout.sessions.create.mockResolvedValue(mockSession);

      const result = await service.createPayment(params);

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        {
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: { name: 'Booking payment' },
                unit_amount: 10000, // 100 * 100
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `https://example.com/payment/${params.transactionId}/success`,
          cancel_url: `https://example.com/payment/${params.transactionId}/cancel`,
          metadata: {
            transactionId: params.transactionId,
            bookingId: params.bookingId,
          },
        },
        { idempotencyKey: params.idempotencyKey },
      );

      expect(result).toEqual({
        externalId: 'cs_test_123',
        redirectUrl: 'https://checkout.stripe.com/pay/cs_test_123',
        meta: mockSession,
      });
    });

    it('should handle different currency codes (EUR, GBP)', async () => {
      const params = {
        transactionId: 'txn-456',
        bookingId: 'book-456',
        amount: 50.5,
        currency: 'EUR',
        idempotencyKey: 'idempotency-456',
      };

      const mockSession = {
        id: 'cs_test_456',
        url: 'https://checkout.stripe.com/pay/cs_test_456',
      } as Checkout.Session;

      stripe.checkout.sessions.create.mockResolvedValue(mockSession);

      await service.createPayment(params);

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({
                currency: 'eur',
                unit_amount: 5050, // 50.5 * 100
              }),
            }),
          ],
        }),
        expect.anything(),
      );
    });

    it('should use fallback URL when session.url is null', async () => {
      const params = {
        transactionId: 'txn-789',
        bookingId: 'book-789',
        amount: 200,
        currency: 'USD',
        idempotencyKey: 'idempotency-789',
      };

      const mockSession = {
        id: 'cs_test_789',
        url: null,
      } as unknown as Checkout.Session;

      stripe.checkout.sessions.create.mockResolvedValue(mockSession);

      const result = await service.createPayment(params);

      expect(result.redirectUrl).toBe('https://example.com/payment/txn-789/success');
    });
  });

  describe('cancelPendingCheckoutSession', () => {
    it('expires open checkout sessions', async () => {
      stripe.checkout.sessions.retrieve.mockResolvedValue({ status: 'open' });
      stripe.checkout.sessions.expire.mockResolvedValue({ status: 'expired' });

      await service.cancelPendingCheckoutSession('cs_test_123');

      expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith('cs_test_123');
    });

    it('skips completed checkout sessions', async () => {
      stripe.checkout.sessions.retrieve.mockResolvedValue({ status: 'complete' });

      await service.cancelPendingCheckoutSession('cs_test_123');

      expect(stripe.checkout.sessions.expire).not.toHaveBeenCalled();
    });
  });

  describe('parseEvent', () => {
    it('should parse and verify webhook signature', async () => {
      const rawBody = Buffer.from('test payload');
      const signature = 't=123,v1=abc123';
      const mockEvent = { type: 'payment_intent.succeeded', data: {} };

      stripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = await service.parseEvent(rawBody, signature);

      expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith(rawBody, signature, 'whsec_test');
      expect(result).toEqual(mockEvent);
    });

    it('should throw BadRequestException on invalid signature', async () => {
      const rawBody = Buffer.from('test payload');
      const signature = 'invalid';

      stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Signature verification failed');
      });

      await expect(service.parseEvent(rawBody, signature)).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleWebhook', () => {
    it('should handle checkout.session.completed with paid status', async () => {
      const event = {
        id: 'evt_checkout_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            payment_status: 'paid',
            payment_intent: 'pi_test_123',
            metadata: {
              transactionId: 'txn-123',
              bookingId: 'book-123',
            },
          } as Checkout.Session,
        },
      };

      const result = await service.handleWebhook(event);

      expect(result).toEqual({
        transactionId: 'txn-123',
        bookingId: 'book-123',
        paymentId: 'pi_test_123',
        provider: PaymentProvider.STRIPE,
        eventId: 'evt_checkout_1',
        status: TransactionStatus.SUCCEED,
        method: 'card',
      });
    });

    it('should return null when checkout.session.completed has no metadata', async () => {
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_456',
            payment_status: 'paid',
            metadata: {},
          } as Checkout.Session,
        },
      };

      const result = await service.handleWebhook(event);

      expect(result).toBeNull();
    });

    it('should handle payment_intent.succeeded', async () => {
      const event = {
        id: 'evt_pi_1',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_789',
            metadata: {
              transactionId: 'txn-789',
              bookingId: 'book-789',
            },
          },
        },
      };

      const result = await service.handleWebhook(event);

      expect(result).toEqual({
        transactionId: 'txn-789',
        bookingId: 'book-789',
        paymentId: 'pi_test_789',
        provider: PaymentProvider.STRIPE,
        eventId: 'evt_pi_1',
        status: TransactionStatus.SUCCEED,
        method: 'card',
      });
    });

    it('should handle payment_intent.payment_failed', async () => {
      const event = {
        id: 'evt_pi_fail',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_test_fail',
            metadata: {
              transactionId: 'txn-fail',
              bookingId: 'book-fail',
            },
          },
        },
      };

      const result = await service.handleWebhook(event);

      expect(result).toEqual({
        transactionId: 'txn-fail',
        bookingId: 'book-fail',
        paymentId: 'pi_test_fail',
        provider: PaymentProvider.STRIPE,
        eventId: 'evt_pi_fail',
        status: TransactionStatus.FAILED,
        method: 'card',
      });
    });

    it('should return null for payment_intent.succeeded without metadata', async () => {
      const event = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_no_meta',
            metadata: null,
          },
        },
      };

      const result = await service.handleWebhook(event);

      expect(result).toBeNull();
    });

    it('should return null for unhandled event types', async () => {
      const event = {
        type: 'charge.refunded',
        data: { object: {} },
      };

      const result = await service.handleWebhook(event);

      expect(result).toBeNull();
    });

    it('should handle checkout.session.completed with failed payment', async () => {
      const event = {
        id: 'evt_checkout_failed',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_failed',
            payment_status: 'unpaid',
            payment_intent: 'pi_test_failed',
            metadata: {
              transactionId: 'txn-failed',
              bookingId: 'book-failed',
            },
          } as Checkout.Session,
        },
      };

      const result = await service.handleWebhook(event);

      expect(result).toEqual({
        transactionId: 'txn-failed',
        bookingId: 'book-failed',
        paymentId: 'pi_test_failed',
        provider: PaymentProvider.STRIPE,
        eventId: 'evt_checkout_failed',
        status: TransactionStatus.FAILED,
        method: 'card',
      });
    });
  });
});
