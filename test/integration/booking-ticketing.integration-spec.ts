import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { BookingStatus, TransactionStatus, PaymentProvider } from '@prisma/client';

import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { PaymentHandler } from 'src/modules/payment/handlers/payment.handler';
import { OutboxProcessor } from 'src/infra/outbox/outbox.processor';
import { PdfService } from 'src/infra/pdf/pdf.service';
import { KafkaPublisher } from 'src/infra/kafka/kafka.publisher';
import { KafkaConsumer } from 'src/infra/kafka/kafka.consumer';
import { MailService } from 'src/infra/mail/mail.service';
import { applyIntegrationTestEnv } from '../helpers/integration-env';
import {
  ensureMinioBucket,
  loadIntegrationEnv,
  resolveComposeInfra,
} from '../helpers/integration-infra';
import { seedPendingPaymentBooking } from '../fixtures/booking-payment.fixture';

async function waitFor<T>(
  fn: () => Promise<T | null | undefined>,
  timeoutMs = 60_000,
  intervalMs = 500,
): Promise<T> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await fn();
    if (result) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

describe('Booking ticketing async chain (integration)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let prisma: PrismaService;
  let paymentHandler: PaymentHandler;
  let outboxProcessor: OutboxProcessor;

  beforeAll(async () => {
    loadIntegrationEnv();
    const infra = resolveComposeInfra();

    await ensureMinioBucket(infra.s3Endpoint);

    applyIntegrationTestEnv(infra);

    const kafkaNoop = {
      onModuleInit: jest.fn().mockResolvedValue(undefined),
      onModuleDestroy: jest.fn().mockResolvedValue(undefined),
    };

    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(KafkaPublisher)
      .useValue({
        ...kafkaNoop,
        publish: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(KafkaConsumer)
      .useValue(kafkaNoop)
      .overrideProvider(PdfService)
      .useValue({
        generateEticket: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 integration-test')),
      })
      .overrideProvider(MailService)
      .useValue({
        sendBookingSuccess: jest.fn().mockResolvedValue(undefined),
        sendBookingFailed: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    paymentHandler = moduleFixture.get(PaymentHandler);
    outboxProcessor = moduleFixture.get(OutboxProcessor);

    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect().catch(() => undefined);
    await app?.close().catch(() => undefined);
  });

  it('GET /health/ready reports rabbitmq when broker is connected', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.info.rabbitmq.status).toBe('up');
  });

  it('fulfills payment webhook result through outbox → rabbitmq → bullmq → TICKETED', async () => {
    const { booking, transaction } = await seedPendingPaymentBooking(prisma);

    await paymentHandler.processResult({
      transactionId: transaction.id,
      bookingId: booking.id,
      paymentId: 'pi_integration_test',
      provider: PaymentProvider.STRIPE,
      eventId: `evt_integration_${booking.id}`,
      status: TransactionStatus.SUCCEED,
    });

    const paidBooking = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(paidBooking.status).toBe(BookingStatus.PAID);

    await outboxProcessor.handle();

    const ticketedBooking = await waitFor(async () => {
      const current = await prisma.booking.findUnique({
        where: { id: booking.id },
        include: { tickets: true },
      });

      return current?.status === BookingStatus.TICKETED ? current : null;
    });

    expect(ticketedBooking.tickets).toHaveLength(1);
    expect(ticketedBooking.tickets[0]?.pdfKey).toMatch(/^tickets\//);
    expect(ticketedBooking.tickets[0]?.ticketNumber).toBeTruthy();
  });
});
