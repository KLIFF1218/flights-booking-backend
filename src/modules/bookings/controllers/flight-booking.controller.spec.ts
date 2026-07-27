import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FlightBookingController } from './flight-booking.controller';
import { BookingWorkflowService } from '../services/booking-workflow.service';
import { BookingsService } from '../services/bookings.service';
import { BookingPaymentService } from '../services/booking-payment.service';

describe('FlightBookingController', () => {
  let controller: FlightBookingController;
  let module: TestingModule;
  const workflow = {
    createBooking: jest.fn(),
    getById: jest.fn(),
    addTravelers: jest.fn(),
    assignSeats: jest.fn(),
    confirmSeatsAndStartPayment: jest.fn(),
  };
  const bookings = {
    findAllByUser: jest.fn(),
    cancel: jest.fn(),
  };
  const payment = {
    resumePayment: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      controllers: [FlightBookingController],
      providers: [
        { provide: BookingWorkflowService, useValue: workflow },
        { provide: BookingsService, useValue: bookings },
        { provide: BookingPaymentService, useValue: payment },
      ],
    }).compile();

    controller = module.get(FlightBookingController);
  });

  afterEach(async () => {
    await module?.close();
  });

  it('requires idempotency key for create', async () => {
    await expect(
      controller.booking({ searchId: 's', offerId: 'o' } as any, 'user-1', '  '),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('delegates create to workflow', async () => {
    workflow.createBooking.mockResolvedValue({ id: 'booking-1' });

    await expect(
      controller.booking({ searchId: 's', offerId: 'o' } as any, 'user-1', 'idem-1'),
    ).resolves.toEqual({ id: 'booking-1' });

    expect(workflow.createBooking).toHaveBeenCalledWith(
      { searchId: 's', offerId: 'o' },
      'user-1',
      'idem-1',
    );
  });

  it('delegates list, get, travelers, seats, checkout, cancel, resume', async () => {
    bookings.findAllByUser.mockResolvedValue({ bookings: [] });
    workflow.getById.mockResolvedValue({ id: 'b1' });
    workflow.addTravelers.mockResolvedValue({ id: 'b1' });
    workflow.assignSeats.mockResolvedValue({ id: 'b1' });
    workflow.confirmSeatsAndStartPayment.mockResolvedValue({ paymentUrl: 'url' });
    bookings.cancel.mockResolvedValue({ id: 'b1', status: 'CANCELED' });
    payment.resumePayment.mockResolvedValue({ paymentUrl: 'url' });

    await expect(controller.getUserBookings('user-1', { page: 1, limit: 20 } as any)).resolves.toEqual(
      { bookings: [] },
    );
    await expect(controller.getBookingById('b1', 'user-1')).resolves.toEqual({ id: 'b1' });
    await expect(
      controller.addTravelers('b1', 'user-1', { travelers: [] } as any),
    ).resolves.toEqual({ id: 'b1' });
    await expect(
      controller.assignSeats('b1', 'user-1', { seats: [] } as any),
    ).resolves.toEqual({ id: 'b1' });
    await expect(
      controller.confirmSeatsAndPay('b1', 'user-1', { searchId: 's', offerId: 'o', seats: [] }),
    ).resolves.toEqual({ paymentUrl: 'url' });
    await expect(controller.cancelBooking('b1', 'user-1')).resolves.toEqual({
      id: 'b1',
      status: 'CANCELED',
    });
    await expect(controller.resumePayment('b1', 'user-1')).resolves.toEqual({ paymentUrl: 'url' });
  });
});
