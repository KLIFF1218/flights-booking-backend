import { Test, type TestingModule } from '@nestjs/testing';
import { BookingTicketController } from './booking-ticket.controller';
import { BookingTicketService } from '../services/booking-ticket.service';

describe('BookingTicketController', () => {
  let controller: BookingTicketController;
  let module: TestingModule;
  const ticketService = { getTickets: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      controllers: [BookingTicketController],
      providers: [{ provide: BookingTicketService, useValue: ticketService }],
    }).compile();

    controller = module.get(BookingTicketController);
  });

  afterEach(async () => {
    await module?.close();
  });

  it('delegates getTickets to BookingTicketService', async () => {
    ticketService.getTickets.mockResolvedValue([{ id: 't1' }]);

    await expect(controller.getTickets('booking-1', 'user-1', 'download')).resolves.toEqual([
      { id: 't1' },
    ]);
    expect(ticketService.getTickets).toHaveBeenCalledWith('booking-1', 'user-1', 'download');
  });
});
