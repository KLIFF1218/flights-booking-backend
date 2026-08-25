import { Test, type TestingModule } from '@nestjs/testing';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordService],
    }).compile();

    service = module.get(PasswordService);
  });

  it('hash and verify round-trip', async () => {
    const hash = await service.hash('Password123!');
    expect(hash).not.toBe('Password123!');
    await expect(service.verify(hash, 'Password123!')).resolves.toBe(true);
    await expect(service.verify(hash, 'wrong')).resolves.toBe(false);
  });

  it('verify returns false for malformed hash', async () => {
    await expect(service.verify('not-a-valid-hash', 'Password123!')).resolves.toBe(false);
  });
});
