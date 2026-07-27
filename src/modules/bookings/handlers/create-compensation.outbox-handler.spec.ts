import { Test, type TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { CreateCompensationOutboxHandler } from './create-compensation.outbox-handler';
import { BookingsService } from '../services/bookings.service';

describe('CreateCompensationOutboxHandler', () => {
  let handler: CreateCompensationOutboxHandler;
  let module: TestingModule;
  const bookingsService = { compensateFailedCreateBooking: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      providers: [
        CreateCompensationOutboxHandler,
        { provide: BookingsService, useValue: bookingsService },
        { provide: Logger, useValue: { warn: jest.fn() } },
      ],
    }).compile();

    handler = module.get(CreateCompensationOutboxHandler);
  });

  afterEach(async () => {
    await module?.close();
  });

  it('delegates to BookingsService.compensateFailedCreateBooking', async () => {
    await handler.handle({ bookingId: 'b1', userId: 'u1' });

    expect(bookingsService.compensateFailedCreateBooking).toHaveBeenCalledWith('b1', 'u1');
  });
});
