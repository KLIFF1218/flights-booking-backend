import { Test, type TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentTransactionQueryService } from '../services/payment-transaction-query.service';
import { NotFoundException } from '@nestjs/common';

describe('PaymentController', () => {
  let controller: PaymentController;
  let paymentTransactionQuery: { getTransactionStatus: jest.Mock };

  beforeEach(async () => {
    paymentTransactionQuery = {
      getTransactionStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [{ provide: PaymentTransactionQueryService, useValue: paymentTransactionQuery }],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should throw NotFoundException when transaction is missing', async () => {
    paymentTransactionQuery.getTransactionStatus.mockRejectedValue(new NotFoundException());

    await expect(controller.getTransactionStatus('tx_1', 'user_1')).rejects.toThrow(
      NotFoundException,
    );
    expect(paymentTransactionQuery.getTransactionStatus).toHaveBeenCalledWith('tx_1', 'user_1');
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

    paymentTransactionQuery.getTransactionStatus.mockResolvedValue(response);

    const result = await controller.getTransactionStatus('tx_1', 'user_1');

    expect(result).toEqual(response);
    expect(paymentTransactionQuery.getTransactionStatus).toHaveBeenCalledWith('tx_1', 'user_1');
  });
});
