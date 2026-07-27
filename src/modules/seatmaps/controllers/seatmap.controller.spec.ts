import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SeatmapsController } from './seatmap.controller';
import { SeatMapsService } from '../services/seatmap.service';

describe('SeatmapsController', () => {
  let controller: SeatmapsController;
  let seatMapsService: { getSeatMapByOffer: jest.Mock };

  beforeEach(async () => {
    seatMapsService = {
      getSeatMapByOffer: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeatmapsController],
      providers: [{ provide: SeatMapsService, useValue: seatMapsService }],
    }).compile();

    controller = module.get(SeatmapsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates seat map lookup to service', async () => {
    const dto = { searchId: 'search-1', offerId: 'offer-1' };
    const response = {
      unavailable: false,
      seatMaps: [{ segmentId: 'seg-1', availableSeatsCount: 1, grid: [] }],
    };
    seatMapsService.getSeatMapByOffer.mockResolvedValue(response);

    await expect(controller.getSeatMapByOffer(dto)).resolves.toEqual(response);
    expect(seatMapsService.getSeatMapByOffer).toHaveBeenCalledWith(dto);
  });

  it('propagates NotFoundException from service', async () => {
    seatMapsService.getSeatMapByOffer.mockRejectedValue(new NotFoundException('Offer not found'));

    await expect(
      controller.getSeatMapByOffer({ searchId: 'missing', offerId: 'offer-1' }),
    ).rejects.toThrow(NotFoundException);
  });
});
