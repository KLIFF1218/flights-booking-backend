import { Test, type TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from '../services/payment.service';
import { NotFoundException } from '@nestjs/common';

describe('PaymentController', () => {
  let controller: PaymentController;
  let paymentService: { getTransactionStatus: jest.Mock };

  beforeEach(async () => {
    paymentService = {
      getTransactionStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [{ provide: PaymentService, useValue: paymentService }],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should throw NotFoundException when transaction is missing', async () => {
    paymentService.getTransactionStatus.mockRejectedValue(new NotFoundException());

    await expect(controller.getTransactionStatus('tx_1', 'user_1')).rejects.toThrow(
      NotFoundException,
    );
    expect(paymentService.getTransactionStatus).toHaveBeenCalledWith('tx_1', 'user_1');
  });

  it('should return transaction status and ticket urls', async () => {
    const response = {
      transactionId: 'tx_1',
      status: 'PENDING',
      externalId: 'ext_1',
      bookingId: 'booking_1',
      bookingStatus: 'PAYMENT_PENDING',
      booking: {
        id: 'booking_1',
        pnr: 'PNR123',
        snapshot: { foo: 'bar' },
        userEmail: 'user@example.com',
        travelers: [{ id: 'trav1', firstName: 'Ivan', lastName: 'Ivanov' }],
        tickets: [
          {
            id: 'ticket1',
            travelerId: 'trav1',
            ticketNumber: 'TICK123',
            status: 'ISSUED',
            previewUrl: 'https://download.test/file.pdf',
            downloadUrl: 'https://download.test/file.pdf',
          },
        ],
      },
    };

    paymentService.getTransactionStatus.mockResolvedValue(response);

    const result = await controller.getTransactionStatus('tx_1', 'user_1');

    expect(result).toEqual(response);
    expect(paymentService.getTransactionStatus).toHaveBeenCalledWith('tx_1', 'user_1');
  });
});
