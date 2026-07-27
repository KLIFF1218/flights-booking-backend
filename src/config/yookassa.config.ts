import type { ConfigService } from '@nestjs/config';
import type { YookassaModuleOptions } from 'nestjs-yookassa';

const YOOKASSA_BOOTSTRAP_SHOP_ID = 'disabled';
const YOOKASSA_BOOTSTRAP_API_KEY = 'disabled';

function readCredential(configService: ConfigService, key: string): string | undefined {
  return configService.get<string>(key)?.trim() || undefined;
}

export function isYookassaConfigured(configService: ConfigService): boolean {
  const shopId = readCredential(configService, 'YOOKASSA_SHOP_ID');
  const apiKey = readCredential(configService, 'YOOKASSA_API_KEY');

  if (!shopId || !apiKey) {
    return false;
  }

  if (shopId.startsWith('YOUR_') || apiKey.startsWith('YOUR_')) {
    return false;
  }

  if (shopId === YOOKASSA_BOOTSTRAP_SHOP_ID || apiKey === YOOKASSA_BOOTSTRAP_API_KEY) {
    return false;
  }

  return true;
}

export const getYookassaConfig = (configService: ConfigService): YookassaModuleOptions => {
  if (isYookassaConfigured(configService)) {
    return {
      shopId: readCredential(configService, 'YOOKASSA_SHOP_ID')!,
      apiKey: readCredential(configService, 'YOOKASSA_API_KEY')!,
    };
  }

  return {
    shopId: YOOKASSA_BOOTSTRAP_SHOP_ID,
    apiKey: YOOKASSA_BOOTSTRAP_API_KEY,
  };
};
