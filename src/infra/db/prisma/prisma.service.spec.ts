import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';
import { Logger } from 'nestjs-pino';

describe('PrismaService', () => {
  let service: PrismaService;

  const logger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        {
          provide: Logger,
          useValue: logger,
        },
      ],
    }).compile();

    service = module.get(PrismaService);
    jest.spyOn(service, '$connect').mockResolvedValue(undefined);
    jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);
  });

  it('disconnects on module destroy', async () => {
    await service.onModuleDestroy();

    expect(service.$disconnect).toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith('Database disconnected');
  });
});
